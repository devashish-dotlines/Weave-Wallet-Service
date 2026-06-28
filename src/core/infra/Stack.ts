export class Stack<T> {
  private items: T[] = [];

  // Push an item onto the stack
  push(item: T): void {
    this.items.push(item);
  }

  // Pop an item off the stack
  pop(): T | undefined {
    return this.items.pop();
  }

  // Peek at the top item without removing it
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  // Check if the stack is empty
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  // Get the size of the stack
  size(): number {
    return this.items.length;
  }

  // Clear all items from the stack
  clear(): void {
    this.items = [];
  }
}

// Example usage:
// const stack = new Stack<number>();

// stack.push(10);
// stack.push(20);
// stack.push(30);

// console.log(stack.peek()); // Output: 30
// console.log(stack.pop());  // Output: 30
// console.log(stack.size()); // Output: 2
// console.log(stack.isEmpty()); // Output: false

// stack.clear();
// console.log(stack.isEmpty()); // Output: true
