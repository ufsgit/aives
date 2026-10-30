import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class CampaignService {
    private http = inject(HttpClient);

    Save_Campaign(campaignData) {
        return this.http.post(environment.BasePath + 'Campaign/Save_Campaign/', campaignData);
    }

    Search_Campaign(campaignName: string): Observable<any> {
        const params = { 'Campaign_Name': campaignName };
        return this.http.get(environment.BasePath + 'Campaign/Search_Campaign/', { params });
    }

    Delete_Campaign(campaignId: number) {
        return this.http.get(environment.BasePath + 'Campaign/Delete_Campaign/' + campaignId);
    }
}
