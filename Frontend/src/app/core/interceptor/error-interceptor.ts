import { Injectable, inject } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError, Subject } from 'rxjs';
import { catchError, debounceTime } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DialogBox_Component } from '../../shared/components/DialogBox/DialogBox.component';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    private router = inject(Router);
    dialogBox = inject(MatDialog);

    private errorSubject = new Subject<string>();

    constructor() {
        // Subscribe to the error subject to handle debounced error messages
        this.errorSubject.pipe(debounceTime(500)).subscribe(errorMessage => {
            this.showErrorMessage(errorMessage);
        });
    }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            console.log('err: ', err);
            if ([401, 403].includes(err.status)) {
                let user = localStorage.getItem('User_Type')
                localStorage.clear();
                const userType = Number(user);
                if (userType === 1 || userType === 2 || userType === 3) {
                    this.router.navigateByUrl('auth');
                } else if (userType === 4) { // Assuming 4 or something else for students if they ever use this
                    this.router.navigateByUrl('auth/user');
                } else {
                    this.router.navigateByUrl('auth');
                }
            }
 
            // Extract error message
            const errorMessage = err?.error?.error?.message
                || err?.error?.errors?.message
                || err?.error?.message
                || err?.message
                || err?.statusText
                || 'An error occurred';
            console.log('errorMessage: ', errorMessage);

            // Push the error message to the error subject
            this.errorSubject.next(errorMessage);

            // Return throwError to propagate the error to the subscriber
            return throwError(() => errorMessage);
        }));
    }

    private showErrorMessage(message: string): void {
        const dialogRef = this.dialogBox.open(DialogBox_Component, {
            panelClass: 'Dialogbox-Class',
            data: { Message: message, Type: "2" },
        });
    }
}
