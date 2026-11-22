/* AUTOMATICALLY GENERATED CODE DO NOT MODIFY */
/*   To generate run: "serverpod generate"    */

// ignore_for_file: implementation_imports
// ignore_for_file: library_private_types_in_public_api
// ignore_for_file: non_constant_identifier_names
// ignore_for_file: public_member_api_docs
// ignore_for_file: type_literal_in_constant_pattern
// ignore_for_file: use_super_parameters
// ignore_for_file: invalid_use_of_internal_member
// ignore_for_file: dead_code, unnecessary_type_check

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:groundlink_app_client/src/protocol/attendance_record.dart'
    as _icyhxoxw;
import 'package:serverpod_auth_core_client/serverpod_auth_core_client.dart'
    as _iacc;
import 'package:serverpod_auth_idp_client/serverpod_auth_idp_client.dart'
    as _iaic;
import 'package:serverpod_client/serverpod_client.dart' as _isc;
import 'attendance_record.dart' as _ixvdsmvt;
import 'attendance_session.dart' as _i4rxvz28;
import 'greetings/greeting.dart' as _izw8z7ou;
export 'attendance_record.dart';
export 'attendance_session.dart';
export 'greetings/greeting.dart';
export 'client.dart';

class Protocol extends _isc.SerializationManager
    implements _isc.ProtocolDeserializationProvider {
  Protocol._();

  factory Protocol() => _instance;

  static final Protocol _instance = Protocol._().._registerHostProtocols();

  @override
  _isc.ProtocolDeserialization get deserializationMetadata =>
      _isc.ProtocolDeserialization.cached(
        this,
        types: const [
          _isc.getType<_ixvdsmvt.AttendanceRecord>,
          _isc.getType<_i4rxvz28.AttendanceSession>,
          _isc.getType<_izw8z7ou.Greeting>,
          _isc.getType<_ixvdsmvt.AttendanceRecord?>,
          _isc.getType<_i4rxvz28.AttendanceSession?>,
          _isc.getType<_izw8z7ou.Greeting?>,
          _isc.getType<List<_icyhxoxw.AttendanceRecord>>,
        ],
        modules: const [
          _iaic.Protocol.new,
          _iacc.Protocol.new,
        ],
        classNames: const [
          'AttendanceRecord',
          'AttendanceSession',
          'Greeting',
        ],
      );

  static String? getClassNameFromObjectJson(dynamic data) =>
      _isc.ProtocolDeserialization.readClassName(data);

  @override
  T deserialize<T>(
    dynamic data, [
    Type? t,
  ]) {
    t ??= T;
    final rawDataClassName = _isc.ProtocolDeserialization.readClassName(data);
    final dataClassName = rawDataClassName;
    if (dataClassName != null && dataClassName != getClassNameForType(t)) {
      try {
        return deserializeByClassName({
          'className': dataClassName,
          'data': data,
        });
      } on _isc.DeserializationClassNameNotFoundException catch (_) {
        // If the className is not recognized (e.g., older client receiving
        // data with a new subtype), fall back to deserializing without the
        // className, using the expected type T.
      }
    }

    if (t == _ixvdsmvt.AttendanceRecord) {
      return _ixvdsmvt.AttendanceRecord.fromJson(data) as T;
    }
    if (t == _i4rxvz28.AttendanceSession) {
      return _i4rxvz28.AttendanceSession.fromJson(data) as T;
    }
    if (t == _izw8z7ou.Greeting) {
      return _izw8z7ou.Greeting.fromJson(data) as T;
    }
    if (t == _isc.getType<_ixvdsmvt.AttendanceRecord?>()) {
      return (data != null ? _ixvdsmvt.AttendanceRecord.fromJson(data) : null)
          as T;
    }
    if (t == _isc.getType<_i4rxvz28.AttendanceSession?>()) {
      return (data != null ? _i4rxvz28.AttendanceSession.fromJson(data) : null)
          as T;
    }
    if (t == _isc.getType<_izw8z7ou.Greeting?>()) {
      return (data != null ? _izw8z7ou.Greeting.fromJson(data) : null) as T;
    }
    if (t == List<_icyhxoxw.AttendanceRecord>) {
      return (data as List)
              .map((e) => deserialize<_icyhxoxw.AttendanceRecord>(e))
              .toList()
          as T;
    }
    final modules = deserializationMetadata.modulesForDeserialization(
      t,
      className: rawDataClassName,
    );
    for (final module in modules) {
      try {
        return module.deserialize<T>(data, t);
      } on _isc.DeserializationTypeNotFoundException catch (_) {}
    }

    return super.deserialize<T>(data, t);
  }

  static String? getClassNameForType(Type type) {
    return switch (type) {
      _ixvdsmvt.AttendanceRecord => 'AttendanceRecord',
      _i4rxvz28.AttendanceSession => 'AttendanceSession',
      _izw8z7ou.Greeting => 'Greeting',
      _ => null,
    };
  }

  @override
  String? getClassNameForObject(Object? data) {
    String? className = super.getClassNameForObject(data);
    if (className != null) return className;

    if (data is Map<String, dynamic> && data['__className__'] is String) {
      return (data['__className__'] as String).replaceFirst(
        'groundlink_app.',
        '',
      );
    }

    switch (data) {
      case _ixvdsmvt.AttendanceRecord():
        return 'AttendanceRecord';
      case _i4rxvz28.AttendanceSession():
        return 'AttendanceSession';
      case _izw8z7ou.Greeting():
        return 'Greeting';
    }
    className = _iaic.Protocol().getClassNameForObject(data);
    if (className != null) {
      return className.contains('.')
          ? className
          : 'serverpod_auth_idp.$className';
    }
    className = _iacc.Protocol().getClassNameForObject(data);
    if (className != null) {
      return className.contains('.')
          ? className
          : 'serverpod_auth_core.$className';
    }
    return null;
  }

  @override
  dynamic deserializeByClassName(Map<String, dynamic> data) {
    var dataClassName = data['className'];
    if (dataClassName is! String) {
      return super.deserializeByClassName(data);
    }
    if (dataClassName == 'AttendanceRecord') {
      return deserialize<_ixvdsmvt.AttendanceRecord>(data['data']);
    }
    if (dataClassName == 'AttendanceSession') {
      return deserialize<_i4rxvz28.AttendanceSession>(data['data']);
    }
    if (dataClassName == 'Greeting') {
      return deserialize<_izw8z7ou.Greeting>(data['data']);
    }
    if (dataClassName.startsWith('serverpod_auth_idp.')) {
      return _iaic.Protocol().deserializeByClassName({
        ...data,
        'className': dataClassName.substring(19),
      });
    }
    if (dataClassName.startsWith('serverpod_auth_core.')) {
      return _iacc.Protocol().deserializeByClassName({
        ...data,
        'className': dataClassName.substring(20),
      });
    }
    return super.deserializeByClassName(data);
  }

  void _registerHostProtocols() {
    _iaic.Protocol().registerHostProtocol('groundlink_app', this);
    _iacc.Protocol().registerHostProtocol('groundlink_app', this);
  }

  @override
  String getModuleName() => 'groundlink_app';

  /// Maps any `Record`s known to this [Protocol] to their JSON representation
  ///
  /// Throws in case the record type is not known.
  ///
  /// This method will return `null` (only) for `null` inputs.
  Map<String, dynamic>? mapRecordToJson(Record? record) {
    if (record == null) {
      return null;
    }
    try {
      return _iaic.Protocol().mapRecordToJson(record);
    } catch (_) {}
    try {
      return _iacc.Protocol().mapRecordToJson(record);
    } catch (_) {}
    throw Exception('Unsupported record type ${record.runtimeType}');
  }
}
