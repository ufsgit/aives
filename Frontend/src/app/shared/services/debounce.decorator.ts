export function Debounce(delay: number = 300) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      let isExecuting = false;
      const originalMethod = descriptor.value;
  
      descriptor.value = function (...args: any[]) {
        if (isExecuting) return;
  
        isExecuting = true;
        const context = this;
  
        setTimeout(() => {
          originalMethod.apply(context, args);
          isExecuting = false;
        }, delay);
      };
  
      return descriptor;
    };
  }