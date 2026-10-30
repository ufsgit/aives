import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BaseApi } from '../../shared/services/_BaseApi.Service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(BaseApi);

  login(data){
    console.log('data: ', data);

    return this.http.post('Login/Login_Check',data);
  }
  forgetPassword(data){
    console.log('data: ', data);

    return this.http.post('Login/forgot-password',data);
  }
  User_Login_Check(data){
    console.log('data: ', data);

    return this.http.post('Login/User_Login_Check',data);
  }
  Generate_forget_Password(data){
    console.log('data: ', data);

    return this.http.post('Login/Generate-forget-Password',data);
  }

}
