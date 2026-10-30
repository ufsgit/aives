import { Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SharedModule } from "./shared/shared.module";
import { filter } from 'rxjs';

@Component({
    selector: 'app-root',
    standalone: true,
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    imports: [RouterOutlet, SharedModule]
})
export class AppComponent {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  title = 'Briffni-Frontend';
  showNavbar = false;

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const currentRoute = this.activatedRoute.root;
        this.showNavbar = !this.isAuthRoute(currentRoute);
      });
  }

  private isAuthRoute(route: ActivatedRoute): boolean {
    return route.firstChild?.routeConfig?.path === 'auth' ||  route.firstChild?.routeConfig?.path === 'Deactivate_Account';
  }
}
