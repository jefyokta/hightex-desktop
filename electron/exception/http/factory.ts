import { ClientException } from "./client-exception"
import { HttpException } from "./http-exception"
import { ServerExeption } from "./server-exception"

export class HttpExceptionFactory {
    static create(error:HttpException){
    if (error.response.status >499) {
      return new ServerExeption(error.response,error.message)      
    }
    return new ClientException(error.response,error.message)
  }
}