#!/bin/bash

find . -not \( -wholename "./.git" -prune \) -type f -exec sed -i 's/[ \t]*$//' {} \;
git status --porcelain|grep "M"

if [ "$?" = 0 ]; then
   git commit --quiet -m "remove trailing whitespace" -a
   git pull --quiet --rebase origin master
   git push --quiet origin master
   echo "Successfully fixed and removed all trailing whitespace and pushed to \"master\"";
else
  echo "No trailing whitespace -- YAY!!!!";
fi
