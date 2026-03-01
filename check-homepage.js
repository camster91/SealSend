#!/usr/bin/env node
/**
 * Check if new homepage is deployed
 * Run: node check-homepage.js
 */

const https = require('https');

const options = {
  hostname: 'sealsend.app',
  port: 443,
  path: '/',
  method: 'GET',
  timeout: 10000,
};

console.log('Checking https://sealsend.app/...\n');

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Content-Length:', data.length, 'bytes\n');
    
    // Check for NEW homepage markers
    const newHomepageMarkers = [
      { name: 'Gradient brand class', test: /gradient-brand/.test(data) },
      { name: '"Now in Beta" badge', test: /Now in Beta/.test(data) },
      { name: '"Create Your Invitation" button', test: /Create Your Invitation/.test(data) },
      { name: 'Space Grotesk font', test: /Space_Grotesk/.test(data) },
      { name: 'Primary-600 color', test: /primary-600/.test(data) },
      { name: '"SealSend" (no spaces)', test: />SealSend</.test(data) },
    ];
    
    // Check for OLD homepage markers
    const oldHomepageMarkers = [
      { name: '"Seal and Send" (with spaces)', test: /Seal and Send/.test(data) },
      { name: 'Old brand-600 class', test: /text-brand-600/.test(data) && !/primary-600/.test(data) },
      { name: 'Old pricing section', test: /15 replies/.test(data) },
    ];
    
    console.log('=== NEW Homepage Markers ===');
    let newCount = 0;
    newHomepageMarkers.forEach(marker => {
      const status = marker.test ? '✅ FOUND' : '❌ NOT FOUND';
      console.log(`${status}: ${marker.name}`);
      if (marker.test) newCount++;
    });
    
    console.log('\n=== OLD Homepage Markers ===');
    let oldCount = 0;
    oldHomepageMarkers.forEach(marker => {
      const status = marker.test ? '⚠️  FOUND (old)' : '✅ Not found';
      console.log(`${status}: ${marker.name}`);
      if (marker.test) oldCount++;
    });
    
    console.log('\n=== SUMMARY ===');
    if (newCount >= 4) {
      console.log('✅ NEW homepage is deployed!');
    } else if (oldCount >= 2) {
      console.log('❌ OLD homepage still showing - deployment needed');
    } else {
      console.log('⚠️  Unable to determine - partial deployment?');
    }
    
    console.log(`\nNew markers: ${newCount}/${newHomepageMarkers.length}`);
    console.log(`Old markers: ${oldCount}/${oldHomepageMarkers.length}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

req.end();
