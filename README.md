# khutzpa

Node powered, cross-platform, drop-in replacement for [Chutzpah.exe](http://mmanela.github.io/chutzpah/) that provides easy access to JavaScript testing with Jasmine, providing both pass/fail test results and code coverage measurements on the command-line and in html formats.

khutzpa provides:

1. A [Mocha reporter](https://github.com/litixsoft/karma-mocha-reporter) for the command line, 
2. A Jasmine stand-alone runner for in-browser test reporting, and 
3. Coverage reports made with <a href="https://github.com/karma-runner/karma-coverage">Istabul via karma and <strike>Jasmine</strike> chai</a> (?)
    * ([Maybe?](https://github.com/karma-runner/karma-coverage/blob/06fb9ad858cd1dbe67cf432272771c1b8b59c7f3/package.json#L43) Not sure how chai & sinon are running jasmine syntax tests.)

khutzpa is designed to be run from the command line and/or using the [Chutzpah Runner for VS Code](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner). <a href="#future">Future plans</a> include a Visual Studio Classic extension set.

Amazingly, it seems to mostly work.

---


## Installation & Quickstart

`npm install khutzpa -g`

(Yes, please install globally. Yes, you'll [need to know what `npm` is](https://nodejs.dev/en/learn/an-introduction-to-the-npm-package-manager/).)

Then, to run all tests as defined by a single Chutzpah.json configuration file:

`khutzpa /path/to/config/Chutzpah.json /{command}`

On the command line, khutzpa currently at least partially supports these legacy options:

* File path
    * This can be a directory, a single specific Chutzpah.json file, or a single specific test file.
    * **Must be the first option**
* Common `/{command}`s:
    * `/openInBrowser`
        * Can occur anywhere
        * If no `/{command}` is given, this is the default.
        * Means we're running the Jasmine [stand](https://jasmine.github.io/pages/getting_started.html)-<a href="https://www.testingdocs.com/getting-started-with-jasmine-standalone/" style="color:orange">alone</a> test suite and serving the results in a browser.
    * `/coverage`
        * Can occur anywhere
        * Currently very limited.
            * A coverage run will be performed in Chrome (corollary: Chrome must be installed)
            * It is output to html
            * It is opened in your default browser


Example:

If you've installed on macOS with node set up conventionally, this likely will run the [included test site's test suite](https://github.com/ruffin--/khutzpa/tree/main/tests/fakeSite).

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSite/Chutzpah.json /openInBrowser`

... or, for Windows (replace `[yourUser]`)...

`khutzpa C:\Users\[yourUser]\AppData\Roaming\npm\node_modules\khutzpa\tests\fakeSite\Chutzpah.json /openInBrowser`

See [the wiki](https://github.com/ruffin--/khutzpa/wiki) for in-depth explanations about these and other commands, configurations, and options.

---




## In-depth info, including VSCode usage

* [Wiki](https://github.com/ruffin--/khutzpa/wiki) pages
    * [Currently supported Chutzpah.json options](https://github.com/ruffin--/khutzpa/wiki/Currently-supported-Chutzpah.json-options)
        * [Chutzpah.json Configuration Examples](https://github.com/ruffin--/khutzpa/wiki/Chutzpah.json-Configuration-File-Examples)
    * [Currently supported command line options](https://github.com/ruffin--/khutzpa/wiki/Currently-supported-command-line-options)
    * [Usage with the Chutzpah Runner extension for VS Code](https://github.com/ruffin--/khutzpa/wiki/Usage-with-the-Chutzpah-Runner-extension-for-VS-Code)


---






## Background

#### What's wrong with Chutzpah?

[Chutzpah](http://mmanela.github.io/chutzpah/) was/is a command-line wrapper for running Jasmine testing and [blanket.js](https://github.com/alex-seville/blanket) test coverage tools for JavaScript projects.

The good thing about Chutzpah is that it's a wrapper around a complex set of tools making it exceptionally easy to set them up even without a thorough knowledge of those tools it uses.

The bad thing about Chutzpah is that it's a wrapper around a complex set of tools, and if the tools it's wrapped go stale, it's insanely difficult to update them. Not to mention all that shielding it did for you initially now means you've potentially got no clue what's up under the hood.

Unfortunately, at this point, [Chutzpah's tools are too damn stale](https://www.youtube.com/watch?v=79KzZ0YqLvo). blanket.js hasn't been updated (outside of its license) since 2016 and it doesn't support es6 well. Chutzpah's embedded version of Jasmine isn't much better (though it is a _little_ better. `;^D`).

You can learn more about those issues at the [Chutzpah project](https://github.com/mmanela/chutzpah/issues?q=blanket+is%3Aissue+). Here's [one](https://github.com/mmanela/chutzpah/issues/789) that explains that its coverage tool is toast:

> Coverage does not work on anything but phantom.js and there are no plans to fix that since the library coverage is built on is deprecated so it would require a total rewrite.

Let's fix that by replacing Chutzpah's out of date pieces with modern tools. Jasmine standalone has been upated. We're using [karma](https://karma-runner.github.io/latest/index.html) and [istanbul-lib-coverage](https://github.com/istanbuljs-archived-repos/istanbul-lib-coverage) for coverage instead of [likely defunct blanket.js](https://github.com/alex-seville/blanket). We're no longer using [PhantomJS](https://github.com/ariya/phantomjs/issues/15344) to run headless tests (so we can use es6 and up!) and are using Chrome [and only Chrome for now]. You get the point.

----





#### Future work<span id="future"></span>

Chutzpah ([the original](https://github.com/mmanela/chutzpah)) has excellent Visual Studio integration, including an extension for VS 2019 and 2022.

Currently khutzpa (this pretender to the throne) *does not have a Visual Studio "Classic" extension*. 

Note: I am hopeful we can steal the code to the VS Classic extension (like the context menu stuff [from here](https://github.com/mmanela/chutzpah/tree/master/VisualStudioContextMenu)) and swap out Chutzpah.exe with khutzpa and have an extension working again, but I want this working in VS Code's Chutzpah Runner extension and my builds before we get too far into VS Classic support.

---




## Acknowledgements 

As of 24 May 2023...

* [MIT License](https://opensource.org/licenses/MIT)
    * [Jasmine & Jasmine standalone](https://github.com/jasmine/jasmine/blob/main/MIT.LICENSE)
    * [karma](https://github.com/karma-runner/karma/blob/master/LICENSE)
* [Apache 2.0 License](https://opensource.org/licenses/Apache-2.0)
    * [Chutzpah](https://github.com/mmanela/chutzpah/blob/master/License.txt)
        * Note that not we're really using any code from there, but the "inspiration" is clear. 
        * [Though, again, hopefully stealing the wrapper from the VS Classic extension at some point.]
* [New BSD License](https://opensource.org/licenses/BSD-3-Clause)
    * [Istanbul](https://github.com/istanbuljs/istanbuljs/blob/c7693d4608979ab73ebb310e0a1647e2c51f31b6/packages/istanbul-lib-coverage/index.js#L2)

Each of these may include other dependencies in their package.json requirements. Please review each project for further details.
