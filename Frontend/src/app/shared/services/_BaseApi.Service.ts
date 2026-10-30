/***
 * Base API service for application
 * All http request will be handled from here
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscribable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';


@Injectable({
    providedIn: 'root'
}
)
export class BaseApi {
    private http = inject(HttpClient);


      
      
      
    async delete(api: string): Promise<any> {
        const response = await firstValueFrom(this.http.delete(environment.BasePath + api));
        return response;
      }
      async get(api: string, params?: any): Promise<any> {
        const response = await firstValueFrom(this.http.get(environment.BasePath + api, { params: params }));
        return response;
      }

    // get(api: string, params?: any): Observable<any> {
    //     return this.http.get(environment.BasePath + api, { params: params });
    //   }
    
    createFormData(object: Object, form?: FormData, namespace?: string): FormData {
        const formData = form || new FormData();
        for (const property in object) {
            if (!object.hasOwnProperty(property)) {
                continue;
            }
            const formKey = namespace ? `${namespace}[${property}]` : property;
            if (object[property] instanceof Date) {
                formData.append(formKey, object[property].toISOString());
            } else if (typeof object[property] === 'object' && !(object[property] instanceof File)) {
                this.createFormData(object[property], formData, formKey);
            } else {
                formData.append(formKey, object[property]);
            }
        }
        return formData;
    }
    converToFormData(data: any) {
        const formData = new FormData();
        if (typeof data === 'object') {
            for (const d in data) {
                if (!d) {
                    continue;
                }
                let dataD = data[d];
                if (typeof dataD === 'object') {
                    if (d === 'photos') {
                        let inc = 0;
                        for (const it of dataD) {
                            formData.append(d, it);
                            inc++;
                        }
                    } else {
                        dataD = JSON.stringify(dataD);
                        formData.append(d, dataD);
                    }
                } else {
                    formData.append(d, dataD);
                }
            }
        }
        return formData;
    }

    putFormData(api: string, data: any) {
        return this.put(api, this.converToFormData(data));
    }

    postFormData(api: string, data: any) {
        return this.post(api, this.converToFormData(data));
    }

    async post(api: string, data: any): Promise<any> {
        try {
            const response = await firstValueFrom(this.http.post(environment.BasePath + api, data));
            return response;
        } catch (error) {
            console.error('Error in HTTP request:', error);
            throw error; // Rethrow the error to propagate it to the caller
        }
    }
    

    download(api: string, data: any): Promise<any> {
        return this.http.post(environment.BasePath + api, data, { responseType: 'blob' }).toPromise();
    }

    put(api: string, data: any): Promise<any> {
        return this.http.put(environment.BasePath + api, data).toPromise();
    }

}
