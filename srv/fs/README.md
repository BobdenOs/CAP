# CAP fs

## Design

files (global) -> chunks (domain isolated)

```js
// Will receive all chunks of the file in the whole cluster
const res = await fs.run(cds.ql.SELECT(data).from(files, {name: 'hosts.txt', /* domain: 'cap' */ }))

// Will receive all chunks of the file container within the limited domain specific chunks
const res = await fs.run(cds.ql.SELECT(data).from(files, {name: 'hosts.txt', domain: 'dev.cap' }))

// When writing files it will default to the current domain level of the cap instance
await fs.run(cds.ql.INSERT({name: 'hosts.txt', data: '192.168.123.456 dev.cap', /* domain: 'dev.cap' */ }))

// When a files contents are public and can be consumed by higher level domains it can be included
await fs.run(cds.ql.INSERT({name: 'hosts.txt', data: '10.123.345.567 pub.cap', domain: 'cap' }))

```
