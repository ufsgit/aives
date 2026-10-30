import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'contentFilter',
  standalone: true
})
export class ContentFilterPipe implements PipeTransform {

  transform(contents: any[], filterValue: string): any[] {
    console.log('filterValue: ', filterValue);
    if (!contents || !filterValue) {
      return contents;
    }

    filterValue = filterValue.toLowerCase();

    return contents.filter(content =>
      
      content.contentName.toLowerCase().includes(filterValue)
    );
  }

}
