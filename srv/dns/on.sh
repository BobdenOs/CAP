cd $(dirname "$0")

if which wslpath > /dev/null 2>&1; then
  WSL_INSTANCE=$(wsl.exe -l -v | tr -d '\0' | grep "^\*" | awk '{print $2}')
  CURRENT_PATH=$(pwd | sed 's|^/||' | sed 's|/|\\|g')
  $(wslpath "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe") Start-Process -Verb RunAs "powershell.exe '-Command \\\\wsl.localhost\\${WSL_INSTANCE}\\${CURRENT_PATH}\\on.ps1'"
else
  sudo bash -c 'yes n | cp -i /etc/resolv.conf ./org.resolv.conf 2>/dev/null'
  sudo cp resolv.conf /etc/resolv.conf
  sudo iptables -t nat -A OUTPUT -p udp -d 127.0.0.1 --dport 53 -j DNAT --to-destination 127.0.0.1:5353
  sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j DNAT --to-destination 127.0.0.1:4004
  sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 443 -j DNAT --to-destination 127.0.0.1:4004
fi
