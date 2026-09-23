import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCheckoutUrl} from '../lib/checkout-url.js';
test('checkout links retain signed query and fragment values on HTTPS destinations',()=>{const value='https://checkout.example.com/pay?token=abc%2F123#step';assert.equal(safeCheckoutUrl(value),value);});
test('checkout rejects executable, relative, insecure and credential-bearing links',()=>{for(const url of ['javascript:alert(1)','data:text/html,hi','/checkout','//example.com/pay','http://example.com/pay','https://user:secret@example.com/pay',null,'https://example.com/'+ 'x'.repeat(8192)])assert.throws(()=>safeCheckoutUrl(url),/INVALID_CHECKOUT_URL/);});
