import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
    selector: 'app-error-message',
    template: `
    @if (control()?.hasError(error()) && control()?.touched) {
      <div class="error-message">
        {{ message()  }}
      </div>
    }
    `,
    styles: [`
    ::ng-deep .error-message {
      color: red;
      font-size: 12px;
      margin-top: 5px;
    }
  `],
    standalone: false
})
export class ErrorMessageComponent {
  readonly control = input<AbstractControl | null>(null);
  readonly error = input<string>('');
  readonly message = input<string>('');
}
