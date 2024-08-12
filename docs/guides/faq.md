# Frequently Asked Questions (FAQ)

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
