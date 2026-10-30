export interface Campaign {
    Campaign_ID: number;
    Campaign_Name: string;
    Campaign_Number: string;
    User_IDs: number[];
    User_Names?: string;
    Created_At?: Date;
}
