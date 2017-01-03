import argparse
import codecs
import hashlib
import json
import inspect
import os
import random
import re
import subprocess
import sys
import time
import traceback

from distutils.version import LooseVersion
from netlib.http import Headers
from subprocess import CalledProcessError, Popen, PIPE, STDOUT
from threading import Timer

p = Popen(['mitmdump --version'], stdout=PIPE, stdin=PIPE, stderr=STDOUT, shell=True)
stdout = p.communicate()[0]
mitmversion = stdout.decode()[9:] # remove "mitmdump "

if LooseVersion(mitmversion) >= LooseVersion("0.17"):
    from mitmproxy.models import HTTPResponse
    from mitmproxy.script import concurrent
else:
    from libmproxy.script import concurrent

EVENT_RACE_COMMANDER_HOME = os.path.join(os.path.dirname(__file__), '..')

# Due to mitmproxy's design, must be a URL that actually supports SSL
OUT_FOLDER = 'http://cs.au.dk/out/'
HTTPS_OUT_FOLDER = 'https://cs.au.dk/out/'

REPAIR_SCRIPT = os.path.join(EVENT_RACE_COMMANDER_HOME, 'src/js/commands/instrument.js')

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

config = {}
config_dirty = False
config_path = None
disable_intervals_on_load = False
disable_timeouts_on_load = False
has_config = False
minify = False
original = False
out = {}
useCache = True

html_re = re.compile('^(<!(--)?( )*doctype)|(<html)', re.I)
head_re = re.compile('<head([^>]*)>', re.I)
body_re = re.compile('<body([^>]*)>', re.I)
sanitize_re = re.compile('(\~)|(\s)', re.I)

def handle_html(flow, content):
    result = instrument(flow, content, 'html')
    if disable_intervals_on_load or disable_timeouts_on_load:
        injection = '<script>(function () {'
        if disable_intervals_on_load:
            injection += 'setInterval = function () {};'
        if disable_timeouts_on_load:
            injection += 'if (window._inTimer !== undefined) return;' + \
                'window._inTimer = false;' + \
                'window._nativeSetTimeout = window.setTimeout;' + \
                'window.setTimeout = function (f, ms, postpone) { if (!ms) ms = 0; if ((ms <= 1000 && !window._inTimer) || postpone) return window._nativeSetTimeout.call(window, function () { if (!postpone) window._inTimer = true; try { typeof f === \'function\' ? f() : eval(f); } finally { window._inTimer = false; } }, ms); };'
        injection += '})();</script>'
        instrumented = re.sub(head_re, r'<head\1>' + injection, result)
        if instrumented == result:
            # There is no head tag, inject at <body>
            instrumented = re.sub(body_re, r'<body\1>' + injection, result)
        result = instrumented
    return result

def handle_js(flow, content):
    return instrument(flow, content, 'js')

def looks_like_html(stripped):
    no_whitespace = stripped.replace('\xef\xbb\xbf', '') # remove zero white space characters
    return bool(re.match(html_re, no_whitespace))

def looks_like_javascript(input):
    return not looks_like_json(input) and 'SyntaxError' not in execute(os.path.join(EVENT_RACE_COMMANDER_HOME, 'src/js/commands/parse-js.js'), input, None, True)['stdout']

def looks_like_json(stripped):
    try:
        json.loads(stripped)
        return True
    except:
        return False

def instrument(flow, content, ext):
    try:
        kind = 'repair'
        if hasattr(flow.request, 'no_instr') or (useCache and not hasattr(flow.request, 'alloc_num')):
            kind = kind + '_no_instr'

        url = flow.request.orig_url if hasattr(flow.request, 'orig_url') else flow.request.url
        name = re.sub(sanitize_re, '', os.path.splitext(flow.request.path_components[-1])[0] if len(flow.request.path_components) else 'index')

        hash = hashlib.md5(content).hexdigest()
        fileName = 'cache/' + flow.request.host + '/' + hash + '/' + name + '.' + ext
        instrumentedFileName = 'cache/' + flow.request.host + '/' + hash + '/' + name + '_' + kind + '_.' + ext
        if not os.path.exists('cache/' + flow.request.host + '/' + hash):
            os.makedirs('cache/' + flow.request.host + '/' + hash)
        if not useCache or not os.path.isfile(instrumentedFileName):
            print('Cache miss: ' + fileName + ' from ' + url)
            with open(fileName, 'w') as file:
                if minify and ext == 'js':
                    content = minify_js(content)
                if content.startswith(codecs.BOM_UTF16):
                    file.write(content.decode('utf-16').encode('utf-8'))
                elif content.startswith(codecs.BOM_UTF16_BE):
                    file.write(content.decode('utf-16-be').encode('utf-8'))
                elif content.startswith(codecs.BOM_UTF16_LE):
                    file.write(content.decode('utf-16-le').encode('utf-8'))
                else:
                    file.write(content)
            sub_env = { 'EVENT_RACE_COMMANDER_URL': url }
            execute(REPAIR_SCRIPT + ' --kind ' + ext + ' --o ' + instrumentedFileName, content, sub_env)
        with open (fileName if original else instrumentedFileName, "r") as file:
            data = file.read()
        if useCache and hasattr(flow.request, 'alloc_num'):
            prefix = '$_M.onEvent($_L.Event.next(new $_S.OID(\'script\', '
            if data.startswith(prefix):
                data = data[0:len(prefix)] + str(flow.request.alloc_num) + data[data.find(')'):]
        return data
    except:
        print('Exception in processFile() @ proxy.py')
        exc_type, exc_value, exc_traceback = sys.exc_info()
        lines = traceback.format_exception(exc_type, exc_value, exc_traceback)
        print(''.join(lines))
        return content

def minify_js(input):
    return execute(os.path.join(EVENT_RACE_COMMANDER_HOME, 'src/js/commands/minify-js.js'), input, None, True)['stdout']

if LooseVersion(mitmversion) >= LooseVersion("0.18"):
    def start():
        _start(sys.argv)
else:
    def start(context, argv):
        _start(argv)

def _start(argv):
    global config, config_path, disable_intervals_on_load, disable_timeouts_on_load, has_config, minify, original, useCache
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=str, help='path to config', default=None)
    parser.add_argument('--disable-intervals-on-load', action='store_true', help='disable intervals on load to allow measuring loading time', default=False)
    parser.add_argument('--disable-timeouts-on-load', action='store_true', help='disable timeouts on load to allow measuring loading time', default=False)
    parser.add_argument('--disable-timers-on-load', action='store_true', help='disable intervals and timeouts on load to allow measuring loading time', default=False)
    parser.add_argument('--extend-config', action='store_true', help='extend config', default=False)
    parser.add_argument('--minify', action='store_true', help='minify javascript sources', default=False)
    parser.add_argument('--no-cache', action='store_true', help='disable caching', default=False)
    parser.add_argument('--original', action='store_true', help='instrument, but serve the original web app', default=False)
    args, extra_arguments = parser.parse_known_args(argv)

    if args.config:
        config_path = args.config
        has_config = os.path.isfile(config_path)
        if has_config:
            if args.extend_config:
                has_config = False
            with open (config_path, "r") as file:
                config = json.loads(file.read())
            print('using config at ' + config_path)
        else:
            print('writing config to ' + config_path)

            def store_config():
                global config_dirty
                if config_dirty:
                    print('storing config')
                    with open(config_path, 'w') as file:
                        file.write(json.dumps(config))
                    config_dirty = False
                Timer(5.0, store_config).start()

            Timer(5.0, store_config).start()
    if args.disable_intervals_on_load or args.disable_timers_on_load:
        disable_intervals_on_load = True
    if args.disable_timeouts_on_load or args.disable_timers_on_load:
        disable_timeouts_on_load = True
    minify = args.minify
    original = args.original
    useCache = not args.no_cache

if LooseVersion(mitmversion) >= LooseVersion("0.18"):
    def request(flow):
        _request(flow)
else:
    def request(context, flow):
        _request(flow)

def _request(flow):
    flow.request.custom_query = []
    flow.request.orig_url = flow.request.url

    allocNumIdx = flow.request.url.find('allocNum')
    if allocNumIdx >= 0:
        flow.request.alloc_num = flow.request.url[allocNumIdx+9:]
        remainderIdx = flow.request.alloc_num.find('&')
        if remainderIdx >= 0:
            flow.request.url = flow.request.url[0:allocNumIdx-1] + flow.request.alloc_num[remainderIdx:]
            flow.request.alloc_num = flow.request.alloc_num[0:remainderIdx]
        else:
            flow.request.url = flow.request.url[0:allocNumIdx-1]
        flow.request.custom_query.append('allocNum=' + flow.request.alloc_num)

    instrIdx = flow.request.url.find('instr=0')
    if instrIdx >= 0:
        flow.request.no_instr = True
        flow.request.custom_query.append('instr=0')
        flow.request.url = flow.request.url[0:instrIdx-1]

    if flow.request.url.startswith(OUT_FOLDER):
        flow.request.serve_from_out = flow.request.url[len(OUT_FOLDER):]

    if flow.request.url.startswith(HTTPS_OUT_FOLDER):
        flow.request.serve_from_out = flow.request.url[len(HTTPS_OUT_FOLDER):]

    if hasattr(flow.request, 'serve_from_out'):
        filename = flow.request.serve_from_out
        if not filename in out:
            with open (os.path.join(EVENT_RACE_COMMANDER_HOME, 'out', filename), "r") as file:
                print('Reading ' + filename + ' from out/')
                out[filename] = file.read()
        response = HTTPResponse(
            b'HTTP/1.1', 200, b'OK',
            Headers(Content_Type='text/javascript' if filename.find('.js') >= 0 else 'image/gif'),
            out[filename])
        if hasattr(flow.reply, 'send'):
            flow.reply.send(response)
        else:
            flow.response = response

if LooseVersion(mitmversion) >= LooseVersion("0.18"):
    @concurrent
    def response(flow):
        _response(flow)
else:
    @concurrent
    def response(context, flow):
        _response(flow)

def _response(flow):
    global config_dirty

    url = flow.request.url

    if flow.error:
        print('Error: ' + str(flow.error))
    elif not hasattr(flow.request, 'serve_from_out'):
        try:
            flow.response.decode()

            content_type = None
            content_type_key = 'Content-Type'
            cors_key = "Access-Control-Allow-Origin"
            csp_key = None
            location_key = None

            if flow.response.status_code == 204:
                # No Content and a JavaScript request: change the status code such
                # that the code is instrumented (necessary for the 'script execute' hook)
                flow.response.status_code = 200
                content_type = 'text/javascript'

            if flow.request.path.endswith('.js') or hasattr(flow.request, 'alloc_num'):
                content_type = 'text/javascript'
            elif flow.request.path.endswith('.html'):
                content_type = 'text/html'

            for key in flow.response.headers.keys():
                lower = key.lower()
                if lower == 'access-control-allow-origin':
                    cors_key = key
                elif lower == 'content-security-policy':
                    csp_key = key
                elif lower == 'location':
                    location_key = key
                elif lower == 'content-type':
                    content_type_key = key
                    if not content_type:
                        content_type = flow.response.headers[key].lower()

            if location_key:
                if (flow.response.status_code == 301 or flow.response.status_code == 302) and hasattr(flow.request, 'custom_query') and len(flow.request.custom_query) > 0:
                    location = flow.response.headers[location_key]
                    if location.find('?') >= 0:
                        flow.response.headers[location_key] = location + '&' + '&'.join(flow.request.custom_query)
                    else:
                        flow.response.headers[location_key] = location + '?' + '&'.join(flow.request.custom_query)

                # For some reason a redirect loop occurs in the replay for ford.com
                if flow.request.orig_url == flow.response.headers[location_key]:
                    flow.response.headers.pop(location_key, None)
                    flow.response.status_code = 500
                    return;

            content_type = infer_content_type(url, flow.response.content, content_type, not has_config)
            if content_type == 'text/html':
                if flow.response.content:
                    flow.response.content = handle_html(flow, flow.response.content)
                flow.response.headers[content_type_key] = 'text/html'
            elif content_type == 'text/javascript':
                # set 500 to generate an error event, if the server returned
                # an HTML error page for the script...
                if looks_like_html(flow.response.content):
                    flow.response.status_code = 500
                    flow.response.content = 'console.error("Unexpected in proxy.py: was JavaScript, but looks like HTML");'
                else:
                    flow.response.content = handle_js(flow, flow.response.content)
                flow.response.headers[content_type_key] = 'text/javascript'

            if not has_config and not url in config:
                config[url] = content_type
                config_dirty = True

            # Enable CORS
            flow.response.headers[cors_key] = '*'

            # Disable the content security policy since it may prevent instrumented code from executing
            if csp_key:
                flow.response.headers.pop(csp_key, None)
        except:
            print('Exception in response() @ proxy.py')
            exc_type, exc_value, exc_traceback = sys.exc_info()
            lines = traceback.format_exception(exc_type, exc_value, exc_traceback)
            print(''.join(lines))

def infer_content_type(url, data, content_type, infer=False):
    if url in config:
        return config[url]
    if not infer:
        print('Missing content type of ' + url)
        return None

    print('Inferring content type of ' + url)

    stripped = data.strip()
    if content_type:
        if content_type.find('html') >= 0:
            if len(stripped) == 0 or looks_like_html(stripped):
                return 'text/html'
            print(bcolors.WARNING + 'Warning: \'%s\' does not look like HTML, but Content-Type was \'%s\'' % (url, content_type) + bcolors.ENDC)
            print('Source: %s' % (stripped if len(stripped) < 100 else stripped[:100]))
        elif looks_like_html(stripped):
            print(bcolors.WARNING + 'Warning: \'%s\' looks like HTML, but Content-Type was \'%s\'' % (url, content_type) + bcolors.ENDC)
            print('Source: %s' % (stripped if len(stripped) < 100 else stripped[:100]))

        if content_type.find('javascript') >= 0:
            return 'text/javascript'
        elif content_type.find('json') < 0 and stripped and looks_like_javascript(stripped):
            print(bcolors.WARNING + 'Warning: \'%s\' looks like JavaScript, but Content-Type was \'%s\'' % (url, content_type) + bcolors.ENDC)
            print('Source: %s' % (stripped if len(stripped) < 100 else stripped[:100]))
    elif stripped:
        if looks_like_html(stripped):
            print(bcolors.WARNING + 'Warning: \'%s\' looks like HTML, but Content-Type was missing' % (url) + bcolors.ENDC)
            print('Source: %s' % (stripped if len(stripped) < 100 else stripped[:100]))
        elif looks_like_javascript(stripped):
            print(bcolors.WARNING + 'Warning: \'%s\' looks like JavaScript, but Content-Type was missing' % (url) + bcolors.ENDC)
            print('Source: %s' % (stripped if len(stripped) < 100 else stripped[:100]))
    
    return content_type

def encode_input(input):
    if input.startswith(codecs.BOM_UTF16):
        return input.decode('utf-16').encode('utf-8')
    elif input.startswith(codecs.BOM_UTF16_BE):
        return input.decode('utf-16-be').encode('utf-8')
    elif input.startswith(codecs.BOM_UTF16_LE):
        return input.decode('utf-16-le').encode('utf-8')
    return input

def execute(script, stdin=None, env=None, quiet=False):
    """Execute script and print output"""
    try:
        cmd = ["node"] + script.split()
        sub_env = os.environ.copy()
        if (env):
            for key in env.keys():
                sub_env[key] = env[key]
        print(' '.join(cmd))
        p = Popen(cmd, env=sub_env, stdin=PIPE, stdout=PIPE, stderr=subprocess.STDOUT)
        stdout = p.communicate(input=encode_input(stdin) if stdin else None)[0]
        if not quiet:
            print(stdout)
        return { 'stdout': stdout, 'returncode': p.returncode }
    except subprocess.CalledProcessError, e:
        print(e.output)
    return { 'stdout': e.output, 'returncode': 1 }
