#khutzpa $@
#open -a "Terminal" "khutzpa $@"
#osascript -e 'tell application "Terminal" to do script "khutzpa $@"'
# another possible option:
# https://github.com/FWeinb/node-osascript

# NOTE: You may need to execute the following:
# chmod 755 macKhutzpa.sh
# on wherever you put this file for it to work.
echo $@

osascript<<EOF
tell application "Terminal"
    if not (exists window 1) then reopen
    do script "khutzpa $@"
end tell
EOF
