# Cloud Application Platform

This is an experimental example applications that uses [CAP](https://cap.cloud.sap/docs/) to implement a world scale application platform.

[Documentation](./docs/)

## Overview

CAP uses a node-node architecture which allows all nodes in the cluster to self organize. CAP leverages the basic principles of the internet to their fullest extend. CAP is natively based upon the SAP Cloud Application Programming model principles.

## Accepting the Internet

In this section some of the basic principles of the internet will be described. To show their elegance and how they empower CAP.

### Addresses

Commonly known as IP addresses. It is the bare minimum required to connect two devices together. At this point in time the protocol is very mature and widely implemented. By using existing tooling it is possible to configure the core behavior of a CAP cluster. 

Is your network exposed to the public internet ? That means your CAP cluster will be automatically joining the public CAP cloud. 

Is your network not exposed to the public internet ? This will prevent the public cloud from calling your CAP cluster and therefor your cluster will behave as a private CAP cloud.

Is your network part of an intranet ? This will allow your CAP cluster to join your private CAP cloud.

Is your PC connected to an intranet ? This will allow your local CAP development node to access your private cloud, but your PC is not addressable by the private CAP cluster. Therefor it will act as an development CAP cluster.

- Vinton Cerf, Robert Kahn (1974)
- IETF IPv6 (1995)

### Domains

Commonly known as DNS servers. Humans prefer names over magic numbers. To serve this preference domains are introduced to create a layer of abstraction on top of the IP addresses. This comes with the benefit that IP addresses are allowed to change over time while the domain stays stable. Additionally a single domain can be served by multiple IP addresses. Creating a very simplistic version of redundancy and potential load balancing.

Most importantly it introduces hierarchies through sub domains. The CAP cluster manages all its nodes through the DNS service. Allowing nodes to automatically register them self into a cluster. Either at the same domain as the other node or as a subdomain in the cluster. By default a sub domain is allowed to look up to higher level domains. 

As long as a node is visible in the cluster all higher level domain nodes are allowed to assist sub domains with their workload, but they won't expose the sub domain resources to higher level domain nodes. This provides a benefit for small public cloud clusters. As they can handle larger workloads then the cluster could have provided when running as a private cloud cluster. Additionally the public cloud provides resilience by hosting duplicates of the persistency of the sub domain. The major drawback is that it **won't be impossible** to access the data.

- Paul Mockapetris (1983)

### Trust

Commonly known as SSL and TLS (+ mTLS). To keep authentication simple all connection in the CAP cluster are using mTLS. SSL certificates are produced by trusted sources. These authorities already exist and are already trusted to all systems that are intended to connect to the internet. The domain of the node is included inside the certificate. Removing the need to configure the purpose of the CAP node. The configuration inside the certificate is enforced as part of mTLS.

An commonly missed feature of trust based authentication is the capability to distrust. When running private clusters to guarantee safety it is possible to use self signed certificates. While distrusting all other certificates. Preventing otherwise trusted cluster nodes from gaining access to the private cluster.

- netscape (1995)
- IETF (1999)

### Open

A none technical principle of the internet is that it is open. Internet back bones and service providers are forced to co-operate across corporate bounds. This used to stretch much further into individual websites. By providing public APIs that other webpages could leverage to extend and integrate. Once the internet started to be dominated by a small amount of very large websites. They used their dominance to terminate any of these open APIs. Either converting them into payed services, tracking services, advertisement vehicles or terminate them completely.

To stay true to the principles of the internet CAP public cloud functions as a single cluster. If you want to benefit from the CAP public cloud you are required to share the resources available on your nodes. This allows all nodes in the cluster to assist with mitigating any peaks in load on the cluster. Overall benefiting everyone using the CAP public cloud cluster.

You might ask why CAP supports private cloud clusters. There are many valid use cases for running private cloud clusters. Product development best practices require development and test systems to be used before deploying to production. Certain legal requirements might prevent certain pieces of data to be processed by a global cluster (e.g personal, financial, medical records). Most importantly CAP is open source so even if corporations are running their own private cloud clusters. They are able to contribute back with development resources.
