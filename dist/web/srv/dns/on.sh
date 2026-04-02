cd $(dirname "$0")

if which wslpath > /dev/null 2>&1; then
  WSL_INSTANCE=$(wsl.exe -l -v | tr -d '\0' | grep "^\*" | awk '{print $2}')
  CURRENT_PATH=$(pwd | sed 's|^/||' | sed 's|/|\\|g')
  $(wslpath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe") Start-Process -Verb RunAs "powershell.exe '-Command \\\\wsl.localhost\\${WSL_INSTANCE}\\${CURRENT_PATH}\\on.ps1'"
fi

sudo bash -c 'yes n | cp -i /etc/resolv.conf ./org.resolv.conf 2>/dev/null'
sudo cp resolv.conf /etc/resolv.conf

sudo -E $(which node) ./docker.js
