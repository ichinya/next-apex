import bpy, math
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, metallic=0, roughness=.4):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic;bs.inputs['Roughness'].default_value=roughness
    return m

paint=mat('rally_paint',(.025,.30,.68),.28,.27)
dark=mat('rubber',(.019,.025,.030),0,.92)
glass=mat('smoked_glass',(.025,.075,.105),.55,.18)
white=mat('ivory_stripes',(.87,.91,.82),.05,.3)
metal=mat('brushed_alloy',(.38,.45,.47),.8,.27)
light=mat('headlights',(.95,.91,.65),.1,.18)
red=mat('tail_lights',(.62,.045,.025),.1,.26)
root=bpy.data.objects.new('forest_rally_car',None);bpy.context.collection.objects.link(root)

def box(name, loc, size, material, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material);o.parent=root
    if bevel:
        mod=o.modifiers.new('soft_machined_edges','BEVEL');mod.width=bevel;mod.segments=2
        mod=o.modifiers.new('weighted_normals','WEIGHTED_NORMAL')
    return o

box('chassis',(0,0,.48),(4.08,1.80,.54),paint,.14)
box('front_hood',(1.19,0,.82),(1.56,1.73,.32),paint,.09)
box('rear_deck',(-1.43,0,.84),(1.17,1.72,.25),paint,.08)
# An extruded six-point cabin with sloped windscreen and rear glass.
profile=[(-1.02,.77),(-.77,1.34),(-.47,1.48),(.40,1.48),(.92,.86),(.92,.77)]
vertices=[(x,y,z) for y in [-.74,.74] for x,z in profile]
faces=[tuple(range(5,-1,-1)),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
mesh=bpy.data.meshes.new('cabin_shell');mesh.from_pydata(vertices,[],faces);mesh.materials.append(paint)
cab=bpy.data.objects.new('cabin',mesh);bpy.context.collection.objects.link(cab);cab.parent=root
front=box('front_windscreen',(.66,0,1.17),(.66,1.36,.026),glass,.01);front.rotation_euler.y=math.radians(51)
rear=box('rear_windscreen',(-.91,0,1.075),(.43,1.34,.026),glass,.01);rear.rotation_euler.y=math.radians(-65)
for side in [-1,1]:
    box('side_window',(-.12,side*.751,1.17),(.94,.021,.38),glass,.03)
    box('window_pillar',(-.16,side*.77,1.18),(.065,.03,.44),paint,.01)
    box('side_mirror',(.66,side*1.005,.97),(.24,.22,.14),paint,.04)
    box('door_sill',(-.10,side*.90,.48),(1.75,.06,.13),dark,.015)
    box('headlight',(2.052,side*.57,.70),(.045,.40,.21),light,.025)
    box('taillight',(-2.055,side*.59,.73),(.042,.32,.14),red,.02)
    box('hood_stripe',(1.20,side*.24,.99),(1.43,.15,.012),white,.002)
    box('roof_stripe',(-.04,side*.24,1.493),(.79,.15,.012),white,.002)
box('front_grille',(2.06,0,.53),(.045,.69,.20),dark,.01)
box('front_splitter',(1.96,0,.285),(.30,1.91,.10),dark,.025)
box('rear_bumper',(-2.045,0,.43),(.10,1.66,.15),dark,.025)
for side in [-1,1]:
    box('wing_support',(-1.76,side*.52,1.01),(.10,.08,.34),dark,.01)
box('rear_wing',(-1.79,0,1.19),(.32,2.02,.09),dark,.025)
for x in [-1.29,1.27]:
    for side in [-1,1]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.355,depth=.25,location=(x,side*.94,.355),rotation=(math.pi/2,0,0))
        wheel=bpy.context.object;wheel.name=('wheel_front_' if x>0 else 'wheel_rear_')+('left' if side<0 else 'right');wheel.data.materials.append(dark);wheel.parent=root
        bevel=wheel.modifiers.new('tire_shoulder','BEVEL');bevel.width=.045;bevel.segments=2
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.225,depth=.26,location=(x,side*.95,.355),rotation=(math.pi/2,0,0))
        rim=bpy.context.object;rim.name='rally_wheel_alloy';rim.data.materials.append(metal);rim.parent=root
        for a in range(5):
            angle=a*math.tau/5
            spoke=box('wheel_spoke',(x+math.sin(angle)*.12,side*1.085,.355+math.cos(angle)*.12),(.055,.012,.18),white,.006)
            spoke.rotation_euler.y=angle

for o in bpy.context.scene.objects:
    if o.type=='MESH':
        for poly in o.data.polygons:poly.use_smooth=False
