import { ApplicationConfig, EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HTTP_INTERCEPTORS, HttpClientModule, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { ErrorInterceptor } from './core/interceptor/error-interceptor';
import { TokenInterceptor } from './core/interceptor/http.interceptor';
import { APP_BASE_HREF, HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideClientHydration } from '@angular/platform-browser';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';

const providers: (Provider | EnvironmentProviders)[] = [
  provideRouter(routes),
  provideAnimationsAsync(),
  provideClientHydration(),
  provideHttpClient(withInterceptorsFromDi()),
  { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  { provide: APP_BASE_HREF, useValue: '/' },
  { provide: LocationStrategy, useClass: HashLocationStrategy },
  provideLottieOptions({
    player: () => player,
  }),
];

export const appConfig: ApplicationConfig = {
  providers: providers.filter(provider => provider !== undefined) as (Provider | EnvironmentProviders)[],
};