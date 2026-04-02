using from './dns';
using from './fs';
using from './db';
using from './app';
using from './trc';

// REVISIT: find a better way to reach the desired behavior
// Disabled the app folder to prevent the default express.static middleware
// The drawback is that the default app model loading is then also disabled
using from '../app/app';
