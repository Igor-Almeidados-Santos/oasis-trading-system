fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_files = &[
        "../../api/proto/actions.proto",
        "../../api/proto/market_data.proto", //
    ];
    let proto_path = &["../../api/proto"];

    tonic_build::configure()
        .build_server(true) // Continuamos a ser um servidor (RiskValidator)
        .build_client(true) // <-- ADICIONADO: Agora também somos um cliente (OrderExecutor)
        .compile(proto_files, proto_path)?;

    Ok(())
}
