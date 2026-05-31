// virtual-list.js - Virtual scrolling for long lists
// Renders only visible items + buffer for performance

export class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 80; // Estimated item height
    this.bufferSize = options.bufferSize || 5; // Items to render outside viewport
    this.renderFn = options.renderFn || ((item) => document.createElement('div'));
    
    this.items = [];
    this.visibleItems = new Map(); // index -> element
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.scrollHandler = this.onScroll.bind(this);
    this.resizeHandler = this.onResize.bind(this);
    
    this.setupContainer();
    this.attachEvents();
  }

  setupContainer() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    
    // Create spacer for total height
    this.spacer = document.createElement('div');
    this.spacer.style.position = 'absolute';
    this.spacer.style.top = '0';
    this.spacer.style.left = '0';
    this.spacer.style.width = '1px';
    this.spacer.style.height = '0px';
    this.spacer.style.visibility = 'hidden';
    this.container.appendChild(this.spacer);
    
    // Items container
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.style.position = 'relative';
    this.itemsContainer.style.minHeight = '100%';
    this.container.appendChild(this.itemsContainer);
  }

  attachEvents() {
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler);
    this.updateContainerHeight();
  }

  detachEvents() {
    this.container.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
  }

  updateContainerHeight() {
    this.containerHeight = this.container.clientHeight;
  }

  onResize() {
    this.updateContainerHeight();
    this.render();
  }

  onScroll() {
    this.scrollTop = this.container.scrollTop;
    requestAnimationFrame(() => this.render());
  }

  setItems(items) {
    this.items = items;
    this.spacer.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }

  getVisibleRange() {
    const startIdx = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    
    const bufferStart = Math.max(0, startIdx - this.bufferSize);
    const bufferEnd = Math.min(this.items.length - 1, startIdx + visibleCount + this.bufferSize);
    
    return { start: bufferStart, end: bufferEnd };
  }

  render() {
    if (!this.items.length) {
      this.itemsContainer.innerHTML = '';
      this.visibleItems.clear();
      return;
    }

    const { start, end } = this.getVisibleRange();
    const newVisibleItems = new Map();

    // Remove items that are no longer visible
    for (const [idx, element] of this.visibleItems) {
      if (idx < start || idx > end) {
        element.remove();
      } else {
        newVisibleItems.set(idx, element);
      }
    }

    // Add new visible items
    for (let i = start; i <= end; i++) {
      if (!newVisibleItems.has(i)) {
        const element = this.renderFn(this.items[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.left = '0';
        element.style.right = '0';
        element.style.minHeight = `${this.itemHeight}px`;
        this.itemsContainer.appendChild(element);
        newVisibleItems.set(i, element);
      }
    }

    this.visibleItems = newVisibleItems;
  }

  scrollToIndex(index) {
    this.container.scrollTop = index * this.itemHeight;
  }

  destroy() {
    this.detachEvents();
    this.itemsContainer.remove();
    this.spacer.remove();
    this.visibleItems.clear();
    this.items = [];
  }
}

// Specialized virtual scroller for chat messages
export class ChatVirtualList extends VirtualList {
  constructor(container, options = {}) {
    super(container, {
      itemHeight: options.itemHeight || 100,
      bufferSize: options.bufferSize || 3,
      renderFn: options.renderFn
    });
  }

  // Auto-adjust item heights based on content
  measureItemHeights() {
    for (const [idx, element] of this.visibleItems) {
      const height = element.getBoundingClientRect().height;
      // Could store actual heights here for variable height support
    }
  }
}
