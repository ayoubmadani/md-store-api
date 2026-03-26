import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { AuthGuard } from '../auth/guard/auth.guard';

@Controller('domain')
@UseGuards(AuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Post()
  create(@Body() createDomainDto: CreateDomainDto) {
    return this.domainService.create(createDomainDto);
  }

  @Get('store/:storeId')
  sindAllWithStore(@Param('storeId') storeId : string){
    return this.domainService.findAllWithStore(storeId)
  }

  @Get('status/:hostname')
  getStatusFromCloudflare(@Param('hostname') hostname : string){
    return this.domainService.getStatusFromCloudflare(hostname)
  }

  @Delete(':id')
  remove(@Param('id') id : string){
    return this.domainService.remove(id)
  }


  /*@Get()
  findAll() {
    return this.domainService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domainService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDomainDto: UpdateDomainDto) {
    return this.domainService.update(+id, updateDomainDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domainService.remove(+id);
  }*/
}
