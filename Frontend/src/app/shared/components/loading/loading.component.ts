import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

@Component({
    selector: 'app-loading',
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss'],
    standalone: false,
})
export class LoadingComponent implements OnChanges {
  @Input() isLoading: boolean = false;
  lottieOptions: AnimationOptions = {
    path: 'assets/lottie/newScene.json',
  };

  ngOnChanges(changes: SimpleChanges): void {
    console.log('changes: ', changes);
    if (changes['isLoading']) {
      this.isLoading=changes['isLoading'].currentValue
      // Do something when the isLoading property changes
      console.log('isLoading changed:', this.isLoading);
    }
  }}