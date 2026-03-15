import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseUUIDPipe, 
  Query 
} from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plan.service';

@Controller('plans') // المسار الأساسي سيكون: /plans
export class PlansController {
  constructor(private readonly plansService: PlansService) {}   

  @Post()
  async create(@Body() createPlanDto: CreatePlanDto) {
    return await this.plansService.create(createPlanDto);
  }

  @Get()
  async findAll(@Query('active') active?: string) {
    // تحويل الـ Query string إلى Boolean
    const onlyActive = active === 'true';
    return await this.plansService.findAll(onlyActive);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    // ParseUUIDPipe تضمن أن الـ ID المرسل هو UUID صالح قبل دخول الدالة
    return await this.plansService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updatePlanDto: UpdatePlanDto
  ) {
    return await this.plansService.update(id, updatePlanDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.plansService.remove(id);
    return { message: `Plan with ID ${id} deleted successfully` };
  }

  @Patch(':id/toggle')
  async toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return await this.plansService.toggleStatus(id);
  }
}