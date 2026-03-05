import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { TypeThemeService } from './type-theme.service';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { GetUser } from 'src/user/decorator/get-user.decorator';

@Controller('theme')
export class ThemeController {
  constructor(
    private readonly themeService: ThemeService,
    private readonly typeThemeService: TypeThemeService,
  ) { }

  @Post()
  create(@Body() createThemeDto: CreateThemeDto[]) {
    return this.themeService.create(createThemeDto);
  }

  @Get()
  findAll(
    @Query('query') query?: string,
    @Query('isAdmin') isAdmin?: string,
    @Query('type') type?: any, // استخدم النوع المناسب للـ Enum الخاص بك
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    // تمرير القيم للسيرفس مع التأكد من تحويل الأرقام
    return this.themeService.findAll(query, type, Number(page), Number(limit) , Boolean(isAdmin));
  }

  @Get('my')
  @UseGuards(AuthGuard)
  findUserTheme(@GetUser() user: any,){
    const userId = user.id || user.sub;
    return this.themeService.findUserTheme(userId)
  }

  @Get('install-theme/:themeId')
  @UseGuards(AuthGuard)
  installTheme(
    @GetUser() user: any,
    @Param('themeId') themeId:string,
  ){
    const userId = user.id || user.sub;
    return this.themeService.installTheme(themeId ,userId)
  }

  @Post('active-theme')
  @UseGuards(AuthGuard)
  activeTheme(
    @GetUser() user: any,
    @Body() data:any,
  ){
    const userId = user.id || user.sub;
    this.themeService.activeTheme(userId,data)
  }

  @Get('get-one/:id')
  findOne(@Param('id') id: string) {
    return this.themeService.findOne(+id);
  }

  @Get('getallth')
  findAllth(){
    return this.themeService.findAllth()
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeDto) {
    return this.themeService.update(id, updateThemeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.themeService.remove(+id);
  }

  // type

  @Post('type')
  createType(@Body('name') name:string){
    return this.typeThemeService.create(name)
  }

  @Get('type')
  findAllType(){
    return this.typeThemeService.findAll()
  }

  @Delete('type/:id')
  deleteType(@Param('id') id:string){

  }
}
