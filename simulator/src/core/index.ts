// Pure-TS core: pattern engine, Lighting Arbiter, Policy Gate → TIP-004.
//
// CONSTRAINT: this module MUST stay pure TypeScript. Do NOT import React or any
// UI/DOM API here — it has to be unit-testable directly by the eval suite.
export * from './presets';
export * from './patternEngine';
export * from './sources';
export * from './arbiter';
export * from './policyGate';
export * from './flashLimiter';
export * from './resolver';
