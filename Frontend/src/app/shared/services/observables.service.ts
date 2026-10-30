import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ObservablesService {
  private dataSource = new BehaviorSubject<any>(null);
  private studentName = new BehaviorSubject<any>(null);
  private studentEmail = new BehaviorSubject<any>(null);

  data$ = this.dataSource.asObservable();
  Name$ = this.studentName.asObservable();
  Email$ = this.studentEmail.asObservable();

  constructor() {
    this.setData('NavTitle', localStorage.getItem('NavTitle'));
    this.setData('Email', localStorage.getItem('Email'));
    this.setData('Name', localStorage.getItem('Name'));
  }

  setData(key: string, data: any) {
    switch (key) {
      case 'NavTitle':
        this.dataSource.next(data);
        break;
      case 'Email':
        this.studentEmail.next(data);
        break;
      case 'Name':
        this.studentName.next(data);
        break;
      default:
        break;
    }
  }

  getData(key: string) {
    switch (key) {
      case 'NavTitle':
        return this.dataSource.getValue();
      case 'Email':
        return this.studentEmail.getValue();
      case 'Name':
        return this.studentName.getValue();
      default:
        return null;
    }
  }

  clearData(){
    this.setData('NavTitle', 'Dashboard');
    this.setData('Email', null);
    this.setData('Name',null);
  }
}