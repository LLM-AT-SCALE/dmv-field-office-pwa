/* ==========================================================================
   REG 343 — public entry point.

   Consumers import the domain from '@/lib/reg343'; the split into schema,
   validators and supplementary forms is internal. The PDF fill is deliberately
   NOT re-exported here: it pulls in pdf-lib, which no route rendering a
   completeness percentage should have to load.
   ========================================================================== */

export * from './schema';
export * from './validators';
export * from './supplementary';
