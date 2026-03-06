import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController{
    @Get('')
    home(){
        return '<div>🚀 Server is running ...</div>'
    }
}