var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'WeCitio - Mock Server Manager',
  description: 'WeCitio - Mock Server Manager',
  script: 'C:\\dev\\pocs\\mockserver\\bucket-manager\\server.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

svc.on('install',function(){
  svc.start();
});

svc.install();