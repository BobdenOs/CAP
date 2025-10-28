# TODO: configure static secondary according to DHCP default configurations
# TODO: automate WSL2 network route configurations

netsh interface ipv4 set dnsservers "Ethernet" static 172.28.218.112
# netsh interface ipv4 set dnsservers "Ethernet" static 192.168.0.1

# netsh interface ipv6 set dnsservers "Ethernet" static none
netsh interface ipv6 set dnsservers "Ethernet" static fd14:c9c1:a1a7:1::aaaa
# netsh interface ipv6 set dnsservers "Ethernet" static 2a02:8071:b81:c100:4a4e:fcff:fe9a:e85a


# netsh interface ipv6 add route fd14:c9c1:a1a7:1::/64 interface=58
# netsh interface ipv6 add route fe80::/64 interface=58