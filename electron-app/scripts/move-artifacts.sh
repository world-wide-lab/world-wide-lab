#!/bin/bash

# Building upon https://github.com/samuelmeuli/action-electron-builder/issues/14

mkdir dist-linux dist-mac dist-win > /dev/null 2>&1

mv electron-app/dist/latest-linux.yml electron-app/dist/*.AppImage electron-app/dist/*.tar.gz electron-app/dist/*.snap dist-linux > /dev/null 2>&1
mv electron-app/dist/latest-mac.yml electron-app/dist/*.dmg electron-app/dist/*.dmg.blockmap dist-mac > /dev/null 2>&1
mv electron-app/dist/latest.yml electron-app/dist/*.exe electron-app/dist/*.exe.blockmap dist-win > /dev/null 2>&1

exit 0
