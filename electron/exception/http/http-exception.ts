
export class HttpException extends Error {
  constructor(
    public response: Response,
    message: string,
  ) {
    super(message);
  }


}

