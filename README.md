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

## Services

A core principle of SAP Cloud Application Programming model is services. It is a mechanism to provide separation of concerns. With the additional benefit that the Service API is implementation agnostic. CAP comes with a set of core services that are required to fulfill its purpose.

### Database

The database service (`db`) is required for applications to handle their `cds` model definitions. All `entities` that an application defines are persisted by the `db` service. The primary purpose of a database is being able to query the data that is stored within it. There for the `db` service is able to parse `cqn` queries and run them against all defined entities.

### Files

The file service (`fs`) is required to be able to store mass data spread throughout the cluster. The database service uses `fs` as its persistency service. While `fs` also uses `db` to query its own indexes. This enables `fs` to provide full query capabilities without implementing its own `cqn` support. This does create a small drawback as this is a cyclic dependencies.

### Domains

The domain name service (`dns`) provides native `dns/udp` support and enables CAP to manage its cluster. As the cluster grows the `dns` server keeps track of the nodes that exist. It inherently produces a graph of nodes and applications that can be addresses from the current node and potentially its clients. It also serves as a `dns` proxy and cache enabling low level networking performance optimizations.

### Applications

The application service (`app`) provides the endpoints required to deploy applications into the cluster. The application package is stored in `fs`. It exposes the application over a local domain using `dns`. Application level isolation is managed by `app` to ensure consistent functionality.

### Security

The security service (`sec`) provides a custom authentication handler.

TODO: expose centralized authorization entities for application to integration and provide a standardized row level authorization model.
TODO: provides centralized authorization management UI for privilege administration.

### Traces

The trace service (`trc`) provides wholistic telemetry handling. A specialized UI is provided that can be leveraged to identify and visualize trace information. Request `correlation-id` values are propagated through the whole CAP stack to guarantee all inclusive trace information. By leveraging the decentralized nature of `db` it is possible to provide trace insights for all requests. Even if the request originates from private cloud instances. The public cloud nodes are capable of providing trace information for the public sources of the request.

## Intrinsic features

It has become common practice to develop features. In the case of CAP the architecture takes precedence and facilitates solutions that enable users to achieve their goals. This is done by developing a small set of functionalities that combine into intrinsic features. A more common name for intrinsic features is bugs. The primary distinction between the two is whether they do or don't achieve the desired outcomes.

### public / private cloud

There is no implementation in CAP that creates an explicit distinction between a public or private node / cluster. Rather the `dns` implementation adheres to the `ip` standards. There is a concept in `ip` that certain addresses are `unreachable`. By ensuring that the CAP node is hosted behind an `unreachable` address. This node will look private to the public cloud.

### draft / shared drafts

By having the capability to run CAP nodes in a private environment it is possible to create drafts. Depending on where the CAP node is running it might be possible to collaboratively work on these drafts. This is an intrinsic behavior of `db` mixing all layers of data together.

### unified database

From the start `db` has been designed to be capable of creating unified datasets. Even with the initial implementation not including cross node processing. By relying on `fs` providing access to all chunks of the table files `db` is capable of providing unified datasets without any cluster implementation.

### over the edge

As a single CAP node is capable of functioning as a whole cluster. It is possible to step over the edge and extend a cluster into the client. Where most platforms falter with an increased number of users. The true power CAP provides is that every user will be mostly relying on their own hardware. Whether this is done through the default `offline` cluster or explicitly configured clusters all users are contributing to the processing power of the cluster.

### offline

By design CAP is written in javascript and avoids using libraries. This enables CAP to use a simple wrapper and some polyfills to run inside a `Service Worker`. This node functions exactly the same as any other CAP node in the cluster. This means that when the user has started using any application deployed on CAP that they can continue using it no matter what. Once any connection issues are resolved the offline node is capable of persisting all data into the upstream cluster.

### Authentication

By using the well established `mTLS` principles it is possible to authenticate clients and servers through the exact same method. This is a key requirement to enable private and offline clusters to function. If it would be required to go through special authentication methods it would prevent automatic offline cluster creation.
