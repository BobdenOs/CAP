sudo bash -c 'yes n | cp -i /etc/resolv.conf ./org.resolv.conf 2>/dev/null'
sudo cp resolv.conf /etc/resolv.conf
sudo iptables -t nat -A OUTPUT -p udp -d 127.0.0.1 --dport 53 -j DNAT --to-destination 127.0.0.1:5353
sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j DNAT --to-destination 127.0.0.1:4004
sudo iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 443 -j DNAT --to-destination 127.0.0.1:4004
