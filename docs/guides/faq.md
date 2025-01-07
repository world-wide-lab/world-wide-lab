# Frequently Asked Questions (FAQ)

## General

#### I want to recruit people from different sources for my study. Can I keep track of how I recruited them?

Yes, can do this by sending out slightly different URLs to different sources of recruitment e.g. one per newsletter or web-platform. If you put a [query parameter](https://en.wikipedia.org/wiki/Query_string) at the end of the URL to your experiment (e.g. `?source=newsletter`), this will then automatically be recorded in the Session metadata (under `metadata.client.searchParams`).

The final URL would then look something like this: `https://my-awesome.website/studies/exciting-study?source=newsletter`. If you want to add multiple parameters, you can also do this, but please make sure to separate them with an ampersand `&` so that they remain valid a [valid query string](https://en.wikipedia.org/wiki/Query_string).

#### I want to send people from my study to somewhere else / I want to combine different studies across platforms. How can I identify a user when navigating them to another webpage?

You can pass the sessionId as a query parameter in the URL when navigating a user to another webpage. This allows you to identify the user on the new page and link their data later on. For example, if you have a sessionId `example-session-id`, you can create a URL like this: https://my-awesome.website/followup-study?sessionId=example-session-id

To get the sessionId you will need to use the session object. When using the World-Wide-Lab Client library you will have already created this, whereas with the jsPsych integration it is created for you and you can access it through `jsPsychWorldWideLab.session`. You will have to keep the timing in mind, however, as World-Wide-Lab will need to finish initializing before you can access the session object.

To get the session ID from the current session and add it to a URL, you can use code like this:

```js
// ... earlier study code setting up your study, importing libraries, etc.

// Get the session object
// e.g. using the jsPsych integration after it is initialized
const session = jsPsychWorldWideLab.session;

// Get the sessionId from the session object
const sessionId = session.sessionId;
// Create the URL for the next page
const nextPageUrl = "https://my-awesome.website/next-page?sessionId=" + sessionId;
// Navigate to the next page
window.location.href = nextPage;
```

This will create a URL with the sessionId as a query parameter, which you can then use to navigate the user to the next page.

On the new page, you can retrieve the sessionId from the URL and use it as needed. Here's an example of how you might do this in JavaScript:

```js
// Extract the sessionId from the URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
// Do something with the sessionId
console.log('Session ID:', sessionId);
```

## Desktop App

#### Error Message: “World-Wide-Lab.app” is damaged and can’t be opened. You should move it to the Bin

When downloading a development version of World-Wide-Lab on macOS, you might receive an error message, that the app is damaged and can't be opened.

This is slightly misleading, as the only reason for this message is, that we have not officialy signed and notarized this build of the app with Apple.

You can circumvent this message, by running the following command in your terminal (you will need to enter your password for it to complete). The command assumes that World-Wide-Lab.app is in your Applications folder, else just update the path.

```bash
sudo xattr -r -d com.apple.quarantine /Applications/World-Wide-Lab.app
```

#### Where are World-Wide-Lab files & data stored?

The logs and files of the World-Wide-Lab app are stored in the default locations used by the operating system.

Most World-Wide-Lab data is stored under `@World-Wide-Lab/electron-app` in the default app data directory of the operating system:
  - `%APPDATA%` on Windows
  - `$XDG_CONFIG_HOME` or `~/.config` on Linux
  - `~/Library/Application Support` on macOS

You can open the directories by clicking the commands under `File` in the World-Wide-Lab app.

### Deployments

#### Error: `"Command failed with ENOENT: pulumi version"`

When checking the requirements for deployments or executing a deployment command, you may encounter one of the following errors:

```
An Error was encountered: CommandError
code: -2
stdout: 
stderr: Command failed with ENOENT: pulumi version
spawn pulumi ENOENT
```

or 

```
Error Message: Command failed with exit code 127: aws --version
/bin/sh: aws: No such file or directory
```

This means that the required command is not found in the by World-Wide-Lab. Please double check whether you have successfully installed the necessary requirement. If the software is installed correctly and still not found, we may need to tell World-Wide-Lab where to find the software. To do this, please file an issue on the World-Wide-Lab GitHub repository.
