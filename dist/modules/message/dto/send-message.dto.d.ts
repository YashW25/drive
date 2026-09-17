export declare class SendTextMessageDto {
    chatId: string;
    text: string;
}
export declare class SendMediaMessageDto {
    chatId: string;
    url?: string;
    base64?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
}
export declare class MessageResponseDto {
    messageId: string;
    timestamp: number;
}
