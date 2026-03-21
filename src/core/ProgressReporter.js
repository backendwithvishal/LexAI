// ESM imports — both are default exports from their packages
import EventEmitter from 'events';
import cliProgress from 'cli-progress';

/**
 * ProgressReporter - Reports progress during long-running operations
 * 
 * Supports both console output (using cli-progress) and event-based
 * progress reporting for programmatic usage.
 * 
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
 */
class ProgressReporter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.enableConsole = options.enableConsole !== false;
    this.progressBars = new Map();
    this.multibar = null;
    
    if (this.enableConsole) {
      this.multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: '{phase} |{bar}| {percentage}% | {value}/{total} | {status}'
      }, cliProgress.Presets.shades_classic);
    }
  }

  /**
   * Report scanning progress
   * @param {number} processed - Files processed
   * @param {number} total - Total files
   * 
   * Validates: Requirements 21.1
   */
  reportScanProgress(processed, total) {
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    // Emit event for programmatic usage
    this.emit('scanProgress', {
      phase: 'scan',
      processed,
      total,
      percentage
    });
    
    // Update console progress bar
    if (this.enableConsole) {
      if (!this.progressBars.has('scan')) {
        const bar = this.multibar.create(total, 0, {
          phase: 'Scanning',
          status: 'In progress'
        });
        this.progressBars.set('scan', bar);
      }
      
      const bar = this.progressBars.get('scan');
      bar.update(processed, {
        phase: 'Scanning',
        status: `${processed}/${total} files`
      });
    }
  }

  /**
   * Report analysis progress
   * @param {string} currentFile - File being analyzed
   * @param {number} processed - Files processed
   * @param {number} total - Total files
   * 
   * Validates: Requirements 21.2
   */
  reportAnalysisProgress(currentFile, processed, total) {
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    // Emit event for programmatic usage
    this.emit('analysisProgress', {
      phase: 'analysis',
      currentFile,
      processed,
      total,
      percentage
    });
    
    // Update console progress bar
    if (this.enableConsole) {
      if (!this.progressBars.has('analysis')) {
        const bar = this.multibar.create(total, 0, {
          phase: 'Analyzing',
          status: 'In progress'
        });
        this.progressBars.set('analysis', bar);
      }
      
      const bar = this.progressBars.get('analysis');
      bar.update(processed, {
        phase: 'Analyzing',
        status: currentFile
      });
    }
  }

  /**
   * Report phase completion
   * @param {string} phase - Completed phase name
   * @param {number} duration - Time taken in ms
   * 
   * Validates: Requirements 21.5
   */
  reportPhaseCompletion(phase, duration) {
    // Emit event for programmatic usage
    this.emit('phaseComplete', {
      phase,
      duration,
      timestamp: new Date()
    });
    
    // Update console
    if (this.enableConsole) {
      const bar = this.progressBars.get(phase.toLowerCase());
      if (bar) {
        bar.update(bar.getTotal(), {
          phase: phase.charAt(0).toUpperCase() + phase.slice(1),
          status: `Complete (${duration}ms)`
        });
        bar.stop();
      }
    }
  }

  /**
   * Report overall progress percentage
   * @param {number} percentage - Progress 0-100
   * 
   * Validates: Requirements 21.4
   */
  reportOverallProgress(percentage) {
    // Emit event for programmatic usage
    this.emit('overallProgress', {
      percentage,
      timestamp: new Date()
    });
    
    // Update console progress bar
    if (this.enableConsole) {
      if (!this.progressBars.has('overall')) {
        const bar = this.multibar.create(100, 0, {
          phase: 'Overall',
          status: 'In progress'
        });
        this.progressBars.set('overall', bar);
      }
      
      const bar = this.progressBars.get('overall');
      bar.update(percentage, {
        phase: 'Overall',
        status: `${percentage}% complete`
      });
    }
  }

  /**
   * Stop all progress bars and clean up
   */
  stop() {
    if (this.multibar) {
      this.multibar.stop();
    }
    this.progressBars.clear();
  }
}

// Default export — single class, no other exports needed
export default ProgressReporter;
