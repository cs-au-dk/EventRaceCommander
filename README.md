# EventRaceCommander

Information about this tool can be found in the following paper:

* Repairing Event Race Errors by Controlling Nondeterminism, ICSE 2017

## Setup

The following install instructions have been tested on Ubuntu 16.04.1.

#### Dependencies

1. Install Google Chrome from https://www.google.com/chrome

2. Install other dependencies by issuing the following commands:

   ```
   curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
   sudo apt-get install -y git nodejs python-pip python-dev libffi-dev libssl-dev libxml2-dev libxslt1-dev libjpeg8-dev zlib1g-dev g++
   sudo npm install -g http-server protractor@5.0.0
   sudo webdriver-manager update
   pip install mitmproxy==0.18.2
   ```

3. Install mitmproxy

   A. Start mitmproxy by issuing: `mitmdump`

   B. Open http://mitm.it/ in Google Chrome by issuing:

      ```
      google-chrome-stable http://mitm.it/ --proxy-server="127.0.0.1:8080"
      ```
   C. Download the mitmproxy certificate for Ubuntu by clicking on "Other"

   D. Install the mitmproxy certificate: Open `chrome://settings/certificates` in Google Chrome, click on "Authorities", and import the certificiate `mitmproxy-ca-cert.pem`. In addition, issue the following commands.

      ```
      sudo cp ~/Downloads/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/mitmproxy-ca-cert.crt
      sudo update-ca-certificates
      ```

   Test that the mitmproxy certificate is installed correctly, by repeating steps (A) and (B), and opening https://github.com/cs-au-dk/EventRaceCommander in the browser.

#### EventRaceCommander

Issue the following commands:

```
git clone https://github.com/cs-au-dk/EventRaceCommander.git
cd EventRaceCommander
npm install
```

## Trying it out

The repository comes with a set of tests in `test/` that can be run by issuing `./run-tests.sh`.

In order to make the "bad" order of the races in the tests manifest with very high probability, the tests are served using a custom HTTP file server, which is located at `src/js/testing/http-server.js`. This server supports delaying the responses for a given time, by setting the query parameter `delay` (e.g., http://localhost:8080/README.md?delay=1000 will serve this README file after 1000 ms).

#### Browsing with EventRaceCommander

1. Start mitmproxy to instrument all HTML and JavaScript source files on-the-fly:

   ```
   mitmdump --anticache --quiet --no-http2 -p 8081 -s "mitmproxy/proxy.py --no-cache"
   ```

2. Open one of the tests, or any other website, in Google Chrome by issuing:
   
   ```
   ./src/js/testing/http-server.js # only needed for serving the test/ folder
   ./run-chrome.sh http://localhost:8080/test/r4/ajax/index.html
   ```

## Enforcing a new policy

Given a web page `www.foo.com/bar/baz.html`, EventRaceCommander will look for a policy to enforce for that URL at `policies/www.foo.com/bar/baz.html/rule.js`.

**Example**: The policy at `policies/localhost/test/r4/ajax/index.html/rule.js` (see below) ensures that an Ajax-FIFO policy is enforced for the test at http://localhost:8080/test/r4/ajax/index.html.

```
module.exports = function (policy, api, catalogue, queries) {
  policy.add(catalogue.ajaxFifo());
};
```

## Running performance experiments

1. Open Chrome's cookie settings, and enable "Keep local data only until you quit your browser".
   Also, remember to disable automatic locking of the machine.

2. Download and unzip the recordings of the websites from the ICSE 2017 paper:

   ```
   wget http://eventracecommander.casadev.cs.au.dk/recordings.zip
   unzip recordings.zip
   ```

3. Issue the following command to test the performance of the 20 largest companies from the Fortune 20 list, with 50 repetitions for each website:

   ```
   ./run-experiments.js
   ```

The results can be viewed by issuing `http-server` and visiting http://localhost:8080/out/report/.
