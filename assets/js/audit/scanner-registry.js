// scanner-registry.js - Registry for all privacy scanners

import { scan as criticalScan } from './scanners/critical-scanner.js';
import { scan as highScan } from './scanners/high-scanner.js';
import { scan as mediumScan } from './scanners/medium-scanner.js';

export class ScannerRegistry {
  constructor() {
    this.scanners = [
      { name: 'Critical', scan: criticalScan },
      { name: 'High', scan: highScan },
      { name: 'Medium', scan: mediumScan }
    ];
  }

  /**
   * Register a new scanner.
   * @param {{name: string, scan: (chat: object) => object[]}} scanner
   */
  register(scanner) {
    this.scanners.push(scanner);
  }

  /**
   * Scan a single chat with all registered scanners.
   * @param {object} chat
   * @returns {object[]}
   */
  scanChat(chat) {
    const findings = [];
    for (const scanner of this.scanners) {
      try {
        findings.push(...scanner.scan(chat));
      } catch (err) {
        console.error(`[Audit] Scanner "${scanner.name}" failed:`, err);
      }
    }
    return findings;
  }
}

export const defaultRegistry = new ScannerRegistry();
