from rest_framework import serializers
from .models import Track, Genero_Musical, Usuario

class TrackSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='id_track', read_only=True)
    title = serializers.CharField(source='nombre_track')
    price = serializers.IntegerField(source='precio')
    description = serializers.CharField(source='descripcion', allow_null=True, required=False)
    genre = serializers.SerializerMethodField()
    coverUrl = serializers.SerializerMethodField()
    audioUrl = serializers.SerializerMethodField()
    previewUrl = serializers.SerializerMethodField()
    producerId = serializers.SerializerMethodField()
    producerName = serializers.SerializerMethodField()
    producerUsername = serializers.SerializerMethodField()
    producerAvatar = serializers.SerializerMethodField()
    likesCount = serializers.SerializerMethodField()
    bpm = serializers.SerializerMethodField()
    scaleKey = serializers.SerializerMethodField()
    mood = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = [
            'id', 'id_track', 'title', 'nombre_track', 'price', 'precio',
            'description', 'descripcion', 'genre', 'coverUrl', 'audioUrl',
            'previewUrl', 'producerId', 'producerName', 'producerUsername',
            'producerAvatar', 'likesCount', 'bpm', 'scaleKey', 'mood', 'duration'
        ]

    def get_genre(self, obj):
        return obj.genero.descripcion if obj.genero else 'Hip-Hop'

    def get_coverUrl(self, obj):
        request = self.context.get('request')
        if obj.foto:
            return request.build_absolute_uri(obj.foto.url) if request else obj.foto.url
        return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'

    def get_audioUrl(self, obj):
        request = self.context.get('request')
        url = f'/track/{obj.id_track}/preview/'
        return request.build_absolute_uri(url) if request else url

    def get_previewUrl(self, obj):
        return self.get_audioUrl(obj)

    def get_producerId(self, obj):
        return str(obj.usuario.id) if obj.usuario else '1'

    def get_producerName(self, obj):
        if obj.usuario and obj.usuario.user:
            return obj.usuario.user.first_name or obj.usuario.user.username
        return 'Productor BeatCloud'

    def get_producerUsername(self, obj):
        return obj.usuario.user.username if obj.usuario and obj.usuario.user else 'beatmaker'

    def get_producerAvatar(self, obj):
        request = self.context.get('request')
        if obj.usuario and obj.usuario.foto_perfil:
            return request.build_absolute_uri(obj.usuario.foto_perfil.url) if request else obj.usuario.foto_perfil.url
        return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'

    def get_likesCount(self, obj):
        try:
            return obj.usuarios_que_dieron_like.count()
        except Exception:
            return 0

    def get_bpm(self, obj):
        return 140

    def get_scaleKey(self, obj):
        return 'C Minor'

    def get_mood(self, obj):
        return 'Enérgico'

    def get_duration(self, obj):
        return 180

BeatSerializer = TrackSerializer
