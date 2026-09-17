declare class MediaInput {
    url?: string;
    base64?: string;
}
export declare class SendImageStatusDto {
    image: MediaInput;
    caption?: string;
}
export declare class SendVideoStatusDto {
    video: MediaInput;
    caption?: string;
}
export {};
