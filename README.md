# khutzpa

Node powered, cross-platform, drop-in replacement for [Chutzpah.exe](http://mmanela.github.io/chutzpah/) that provides easy access to JavaScript testing with Jasmine, providing both pass/fail test results and code coverage measurements on the command-line and in html formats.

khutzpa provides:

1. A [Mocha reporter](https://github.com/litixsoft/karma-mocha-reporter) for the command line, 
2. A Jasmine stand-alone runner for in-browser test reporting, and 
3. Coverage reports made with <a href="https://github.com/karma-runner/karma-coverage">Istabul via karma and <strike>Jasmine</strike> chai</a> (?)
    * ([Maybe?](https://github.com/karma-runner/karma-coverage/blob/06fb9ad858cd1dbe67cf432272771c1b8b59c7f3/package.json#L43) Not sure how chai & sinon are running jasmine syntax tests.)

khutzpa is designed to be run from the command line and/or using the [Chutzpah Runner for VS Code](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner). <a href="#future">Future plans</a> include a Visual Studio Classic extension set.

Now look, real talk, this is an alpha I initially wrote between visits by the extended fam, in-laws, taxiing kids, etc., and then worked into Windows shape while testing it at the day job. The code is still in need of a serious refactor pass even if it seems to work okay. It'll get better, if only because it hurts my eyes to look at right now. `(╯°□°）╯︵ ┻━┻`

Still, amazingly, it seems to mostly work.

---




## Installation & Quickstart

`npm install khutzpa -g`

(Yes, please install globally. Yes, you'll [need to know what `npm` is](https://nodejs.dev/en/learn/an-introduction-to-the-npm-package-manager/).)

Then, to run all tests as defined by a single Chutzpah.json configuration file:

`khutzpa /path/to/config/Chutzpah.json /{command}`

On the command line, khutzpa currently at least partially supports these legacy options:

* File path
    * This can be a directory or a single specific test file.
    * **Must be the first option**
* `/{command}`s
    * `/openInBrowser`
        * Can occur anywhere
        * Means we're running the Jasmine [stand](https://jasmine.github.io/pages/getting_started.html)-<a href="https://www.testingdocs.com/getting-started-with-jasmine-standalone/" style="color:orange">alone</a> test suite and serving the results in a browser.
    * `/coverage`
        * Can occur anywhere
        * Currently very limited.
            * A coverage run will be performed in Chrome (corollary: Chrome must be installed)
            * It is output to html
            * It is opened in your default browser using a utility server
                * Currently even the server's port is static and cannot be changed (currently 3000).
                * That means if you try to run khutzpa twice without closing the first instance the second call could error out.


Example:

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSite/Chutzpah.json /openInBrowser`

... or, for Windows (replace `[yourUser]`)...

`khutzpa C:\Users\[yourUser]\AppData\Roaming\npm\node_modules\khutzpa\tests\fakeSite\Chutzpah.json /openInBrowser`

---





#### "Walk up commands"

Note that for `/openInBrowser` or `/coverage`, both [standard Chutzpah.exe commands](https://github.com/mmanela/chutzpah/wiki/command-line-options), khutzpa **walks up** the folder hierarchy from the path given until it finds a Chutzpah.json. This means your path can be either...

1. A direct path to the Chutzpah.json file --OR--
2. Any *child* folder of the folder that contains Chutzpah.json whose parents contain a Chutzpah.json file

So instead of this command:

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSite/Chutzpah.json /openInBrowser`

... you could likely use this command...

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSites/fakeTests/testSubdir /openInBrowser`

... or, for a Windows install, something like...

`khutzpa C:\Users\[yourUser]\AppData\Roaming\npm\node_modules\khutzpa\tests\fakeSite\fakeTests\testSubdir /openInBrowser`

The first Chutzpah.json found on the "walk up" will be used.


#### "Walk down commands"

If you have more than one Chutzpah.json file in a folder hierarchy, you can use these ***new*** khutzpa-specific commands that **walk down** a folder hierarchy instead of up and can access multiple Chutzpah.json configuration files in a single run.

1. **Find** all Chutzpah.json files with 
    * `khutzpa /path/to/parent/of/configs /findAllSuites`
    * Do this first and see if the files are what you expect.
2. Find all and **run one** with 
    * `khutzpa /path/to/parent/of/configs /walkAllRunOne`
    * Then enter the index displayed next to the Chutzpah.json path you want to run & hit return.
3. Find **and run all** with 
    * `khutzpa /path/to/parent/of/configs /runAllSuites`
    * Returns 0 if they all return success.
    * Returns first non-zero error code (though continues running all suites) if not.

---






## Usage with [Chutzpah Runner for VS Code](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner)

**WARNING:** There's no threading right now. Things might freeze for a while, especially for larger test suites.

### [Chutzpah Runner](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) with macOS

This takes a little work. There are two ways to link the extension with khutzpa: 

1. Use the shell file that came with the install, or 
2. Make a new shell file somewhere you can access that calls khutzpa. 

Either way, you're going to set a setting in your VS Code preferences for the Chutzpah Runner extension which will point to the script from either 1. or 2.

Let's start with The Easy Way, #1: *Use the script that came with your khutzpa install.* We're going to hope it installed in the normal place, but if you're using nvm it might be somewhere else and these instructions won't work.

1. First you need to install the [Chutzpah Runner](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) extension in VS Code if you haven't.
2. If you haven't installed khutzpa globally, do that with (on macOS) `sudo npm install khutzpa -g`
3. Open a Terminal and type this:
    * `sudo chmod 755 /usr/local/lib/node_modules/khutzpa/macKhutzpa.sh`
    * This allows us to call that script and have it execute as an application.
    * **NOTE:** If you receive a message saying "No such file or directory", you probably have your npm global install in a nonstandard location. 
        * If that does happen, [open an issue](https://github.com/ruffin--/khutzpa/issues) if you'd like and we can take a look.

4. Open VS Code. Hit `Cmd-,` (so literally "Command and comma keys at the same time") to open your preferences. 
5. Hit `Command-F` and search for `Chutzpah`.
6. In the entry for "Chutzpahrunner: Exe Path", enter that same file with its full path:
    * `/usr/local/lib/node_modules/khutzpa/macKhutzpa.sh`

![picture of Exe Path setting UI with correct value](./docs/macOsExePath.png)

7. Save settings and close the tab.

Now things should work! Right-click a file or folder in VS Code's Explorer and run some tests!

Note that khutzpa [purposefully] opens a new Terminal window ***that must be closed or the app quit*** before you can run it again. In the future, I may reuse the express server or have khutzpa check to see if the port it wants to use is already in use. Probably the former.

#### Warnings (macOS)

One known limitation: Right now, the runner is sending a filename for the **coverage** output that khutzpa is ignoring. You can see this under [Chutzpah's command-line options](https://github.com/mmanela/chutzpah/wiki/Command-Line-Options).

The options, which you can view in VS Code's Output window, will look like this:

```
/coveragehtml /var/folders/ry/9v79xg1j7n9fzdfygqmb4q180000gp/T/coverage-4yOxQ2.html
```

For now, khutzpa is ignoring that option and opening the coverage html separately.

Probably not a _huge_ deal, but do note that means you'll have two html files open in your browser with each coverage run for now, one from the Chutzpah Runner extension (that `coverage-4yOxQ2.html` represents) & one from khutzpa.

The weirdly named html file name & opened by the Runner will be empty. Again, not super high on the alpha fix list, but we'll get there.

---





### [Chutzpah Runner](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) with Windows

Very similar to macOS with a few tweaks. Here are the steps.

1. First you need to install the [Chutzpah Runner](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) extension in VS Code if you haven't.
2. If you haven't installed khutzpa globally, do that with `npm install khutzpa -g`
3. Open VS Code. Hit `Cmd-,` (so literally "Command and comma keys at the same time") to open your preferences. 
4. Hit `Command-F` and search for `Chutzpah`.
5. We need to set up a command in the `Chutzpahrunner: Exe Path` section of in Chutzpah Runner's settings (see [picture](./docs/macOsExePath.png) in macOS section, but enter the value discussed here).
    * We have two choices:
        1. Enter the path to the khutzpa npm installation and change the path to match your user name
            * `C:\Users\[yourLogin]\AppData\Roaming\npm\khutzpa.cmd`
        2. Create a .bat file that calls `khutzpa`.
            * contents of .bat file: `khutzpa %*`
            * Then enter the path to the file *inclusive of filename* in `Chutzpahrunner: Exe Path`.
            * For instance, if I save that file in `C:\temp\runKhutzpa.bat`, that's what should be in `Chutzpahrunner: Exe Path`
6. Save settings and close the tab.

Now things should work! Right-click a file or folder in VS Code's Explorer and run some tests or a coverage report.

If things don't work, please [open an issue](https://github.com/ruffin--/khutzpa/issues).

**NOTE:** When you run the "in Chrome" option to open tests in a browser, the Chutzpah Runner is going to open a node terminal. ***You have to close this window yourself to start a new "open in browser" run.***

---




### [Chutzpah Runner](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) with Linux

[It might be a while before I set this up. Let me know if you do it! Should be reasonably straightforward.]

---





### Using in place of Chutzpah.exe

The idea here with `/openInBrowser` and `/coverage` is that you can use khutzpa as a drop-in replacement for Chutzpah.exe for the runner, and khutzpa will digest the same Chutzpah.json configuration files that you had in your project already.

For instance, once set up as described, above, the [Chutzpah Runner extension](https://marketplace.visualstudio.com/items?itemName=dfrencham.chutzpahrunner) might send a command that looks like this:

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSite/ /engine chrome /browserArgs --disable-web-security --user-data-dir=/Users/yourName/ChromeDevSession /openInBrowser /trace /debug`

khutzpa doesn't support all of those options, but will translate that call and do what's intended by this command, essentially:

`khutzpa /usr/local/lib/node_modules/khutzpa/tests/fakeSite/ /openInBrowser`

(Aka, "Heads up! Most of the options the Runner sends aren't currently supported and are ignored by khutzpa." Note also that tests run are not currently limited to those in that child directory; all tests matching the Chutzpah.json will also be run.)




#### Currently supported Chutzpah.json options

That is, **WARNING:** For now, we're, um, taking an "any option you want, [as long as it's black](http://oplaunch.com/blog/2015/04/30/the-truth-about-any-color-so-long-as-it-is-black/)" approach. We're supporting a stark subset of [config file options](https://github.com/mmanela/chutzpah/wiki/Command-Line-Options) and [config](https://github.com/mmanela/chutzpah/wiki/Chutzpah.json-Settings-File) to get the Chutzpah tooling running again with a modernized engine.

Links I the list, below, are to the Chutzpah project's help, which should carry over and behave the same here. [Open an issue](https://github.com/ruffin--/khutzpa/issues) if you find that they don't!

* Standard options
    * [References](https://github.com/mmanela/chutzpah/wiki/references-setting)
    * [Tests](https://github.com/mmanela/chutzpah/wiki/tests-setting)
    * [CodeCoverageIncludes](https://github.com/mmanela/chutzpah/wiki/Code-Coverage-in-Chutzpah#configuration-code-coverage) - "The collection code coverage file patterns to include in coverage. These are in glob format. If you specify none all files are included."
    * <strike>[CodeCoverageExcludes](https://github.com/mmanela/chutzpah/wiki/Code-Coverage-in-Chutzpah#configuration-code-coverage) - "The collection code coverage file patterns to exclude in coverage. These are in glob format. If you specify none no files are excluded."</strike> <<< not actually supported yet
    * [CodeCoverageSuccessPercentage](https://github.com/mmanela/chutzpah/wiki/Chutzpah.json-Settings-File)
        * Same as setting every [karma-coverage check value](https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md#check) in the global section to the given integer.
        * khutzpa will not return a `0` if this fails.
* Non-standard options
    * `AggressiveStar` 
        * I noticed in some legacy projects I'm working with that we use selectors like `*.js` and expect them to get every `*.js` file in any subdirectory. 
        * If `AggressiveStar` isn't *explicitly set to `false`*, that's how it works here now too.
            * [That's not how globs [usually] work](https://www.malikbrowne.com/blog/a-beginners-guide-glob-patterns), though I guess whatever Chutzpah used for globs did?
        * Also resolves `*` values in `CodeCoverageIncludes` to `**` for folders.
            * `*/dir1/dir2/*` will be translated to `**/dir/dir2/**`.


For now, that's it. 

This is an alpha, after all. That said, khutzpa likely won't support all of them when we're "done" either. _That_ said, it's amazing how much just those options buy you.

#### Currently supported command-line options

* Legacy Chutzpah options
    * `/openInBrowser`
        * see above
        * Currently also creates a coverage report, but opens up the Jasmine standalone test page.
    * `/coverage`
        * see above
        * Right now, the coverage report should be placed in a `coverage` directory at the same root as your active Chutzpah.json file.
        * Opens the coverage report as a static html file.
    * `/coveragehtml {/some/file/name.html}`
        * Must be used with `/coverage`, natch.
        * _Minimally_ supported.
        * Still creates a coverage report at the same root as your Chutzpah.json file.
        * Then copies the index.html file into the name given here.
        * Then copies all the supporting html to the same parent folder as the specified file.
        * Basically the minimum to make the Chutzpah runner work.
* Nonstandard options
    * The "walk down" commands described above.
        * `/findAllSuites`
        * `/walkAllRunOne`
        * `/runAllSuites`
    * `/version` -- outputs the version, no less.
    * `/runOne` -- Will run files 

**NOTE:** There's a sample `Chutzpah.json` file in the `test` folder.

---







## Background

#### What's wrong with Chutzpah?

[Chutzpah](http://mmanela.github.io/chutzpah/) was/is a command-line wrapper for running Jasmine testing and [blanket.js](https://github.com/alex-seville/blanket) test coverage tools for JavaScript projects.

The good thing about Chutzpah is that it's a wrapper around a complex set of tools making it exceptionally easy to set them up even without a thorough knowledge of those tools it uses.

The bad thing about Chutzpah is that it's a wrapper around a complex set of tools, and if the tools it's wrapped go stale, it's insanely difficult to update them. Not to mention all that shielding it did for you initially now means you've potentially got no clue what's up under the hood.

Unfortunately, at this point, [Chutzpah's tools are too damn stale](https://www.youtube.com/watch?v=79KzZ0YqLvo). blanket.js hasn't been updated (outside of its license) since 2016 and it doesn't support es6 well. Chutzpah's embedded version of Jasmine isn't much better (though it is a _little_ better. `;^D`).

You can learn more about those issues at the [Chutzpah project](https://github.com/mmanela/chutzpah/issues?q=blanket+is%3Aissue+). Here's [one](https://github.com/mmanela/chutzpah/issues/789) that explains that its coverage tool is D-E-D-dead [sic]:

> Coverage does not work on anything but phantom.js and there are no plans to fix that since the library coverage is built on is deprecated so it would require a total rewrite.

Let's fix that by replacing Chutzpah's out of date pieces with modern tools. Jasmine standalone has been upated. We're using [karma](https://karma-runner.github.io/latest/index.html) and [istanbul-lib-coverage](https://github.com/istanbuljs-archived-repos/istanbul-lib-coverage) for coverage instead of [likely defunct blanket.js](https://github.com/alex-seville/blanket). We're no longer using [PhantomJS](https://github.com/ariya/phantomjs/issues/15344) to run headless tests (so we can use es6 and up!) and are using Chrome [and only Chrome for now]. You get the point.

----




## Future work<span id="future"></span>

Chutzpah ([the original](https://github.com/mmanela/chutzpah)) has excellent Visual Studio integration, including an extension for VS 2019 and 2022.

Currently khutzpa (this pretender to the throne) *does not have a Visual Studio "Classic" extension*. 

Note: I am hopeful we can steal the code to the VS Classic extension (like the context menu stuff [from here](https://github.com/mmanela/chutzpah/tree/master/VisualStudioContextMenu)) and swap out Chutzpah.exe with khutzpa and have an extension working again, but I want this working in VS Code's Chutzpah Runner extension and my builds before we get too far into VS Classic support.

---






# Acknowledgements 

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
