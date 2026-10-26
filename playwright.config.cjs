const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({testDir:'./tests',workers:1,use:{channel:'msedge',headless:true,viewport:{width:1280,height:900}}});
