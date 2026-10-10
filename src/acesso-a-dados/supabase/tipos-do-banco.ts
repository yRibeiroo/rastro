
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "anexos": {
                  Row: {
                    "caminho": string,"criado_em": string,"empresa_id": string,"enviado_por": string | null,"id": string,"nome_arquivo": string,"tamanho_bytes": number,"tipo_mime": string,"transacao_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caminho": string,"criado_em"?: string,"empresa_id": string,"enviado_por"?: string | null,"id"?: string,"nome_arquivo": string,"tamanho_bytes": number,"tipo_mime": string,"transacao_id": string
                  }
                  Update: {
                    "caminho"?: string,"criado_em"?: string,"empresa_id"?: string,"enviado_por"?: string | null,"id"?: string,"nome_arquivo"?: string,"tamanho_bytes"?: number,"tipo_mime"?: string,"transacao_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "anexos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "anexos_empresa_id_transacao_id_fkey"
      columns: ["empresa_id","transacao_id"]
isOneToOne: false
      referencedRelation: "transacoes"
      referencedColumns: ["empresa_id","id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "arquivada": boolean,"criado_em": string,"empresa_id": string,"entra_no_resultado": boolean,"id": string,"nome": string,"padrao": boolean,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivada"?: boolean,"criado_em"?: string,"empresa_id": string,"entra_no_resultado"?: boolean,"id"?: string,"nome": string,"padrao"?: boolean,"tipo": string
                  }
                  Update: {
                    "arquivada"?: boolean,"criado_em"?: string,"empresa_id"?: string,"entra_no_resultado"?: boolean,"id"?: string,"nome"?: string,"padrao"?: boolean,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categorias_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"centros_de_custo": {
                  Row: {
                    "arquivado": boolean,"criado_em": string,"empresa_id": string,"id": string,"nome": string,"padrao": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "arquivado"?: boolean,"criado_em"?: string,"empresa_id": string,"id"?: string,"nome": string,"padrao"?: boolean
                  }
                  Update: {
                    "arquivado"?: boolean,"criado_em"?: string,"empresa_id"?: string,"id"?: string,"nome"?: string,"padrao"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "centros_de_custo_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"conexoes": {
                  Row: {
                    "atualizado_em": string,"banco": string | null,"consentimento_expira_em": string | null,"criado_em": string,"criado_por": string | null,"empresa_id": string,"erro_codigo": string | null,"erro_mensagem": string | null,"id": string,"id_externo": string,"provedor": string,"status": string,"ultima_sincronizacao_em": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"banco"?: string | null,"consentimento_expira_em"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"empresa_id": string,"erro_codigo"?: string | null,"erro_mensagem"?: string | null,"id"?: string,"id_externo": string,"provedor"?: string,"status": string,"ultima_sincronizacao_em"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"banco"?: string | null,"consentimento_expira_em"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"empresa_id"?: string,"erro_codigo"?: string | null,"erro_mensagem"?: string | null,"id"?: string,"id_externo"?: string,"provedor"?: string,"status"?: string,"ultima_sincronizacao_em"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conexoes_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"contas": {
                  Row: {
                    "atualizado_em": string,"conexao_id": string,"criado_em": string,"empresa_id": string,"id": string,"id_externo": string,"moeda": string,"nome": string,"numero": string | null,"saldo": number,"saldo_atualizado_em": string,"tipo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"conexao_id": string,"criado_em"?: string,"empresa_id": string,"id"?: string,"id_externo": string,"moeda"?: string,"nome": string,"numero"?: string | null,"saldo"?: number,"saldo_atualizado_em"?: string,"tipo"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"conexao_id"?: string,"criado_em"?: string,"empresa_id"?: string,"id"?: string,"id_externo"?: string,"moeda"?: string,"nome"?: string,"numero"?: string | null,"saldo"?: number,"saldo_atualizado_em"?: string,"tipo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contas_empresa_id_conexao_id_fkey"
      columns: ["empresa_id","conexao_id"]
isOneToOne: false
      referencedRelation: "conexoes"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "contas_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"empresas": {
                  Row: {
                    "criado_em": string,"id": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: string,"nome": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"eventos_webhook": {
                  Row: {
                    "empresa_id": string | null,"erro": string | null,"event_id": string,"evento": string,"id_externo_conexao": string | null,"processado_em": string | null,"recebido_em": string
                  }
                  ComputedFields: never
                  Insert: {
                    "empresa_id"?: string | null,"erro"?: string | null,"event_id": string,"evento": string,"id_externo_conexao"?: string | null,"processado_em"?: string | null,"recebido_em"?: string
                  }
                  Update: {
                    "empresa_id"?: string | null,"erro"?: string | null,"event_id"?: string,"evento"?: string,"id_externo_conexao"?: string | null,"processado_em"?: string | null,"recebido_em"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_webhook_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"limites_de_requisicao": {
                  Row: {
                    "chave": string,"contador": number,"janela": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chave": string,"contador"?: number,"janela": string
                  }
                  Update: {
                    "chave"?: string,"contador"?: number,"janela"?: string
                  }
                  Relationships: [
                    
                  ]
                },"membros_empresa": {
                  Row: {
                    "criado_em": string,"empresa_id": string,"papel": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"empresa_id": string,"papel"?: string,"user_id": string
                  }
                  Update: {
                    "criado_em"?: string,"empresa_id"?: string,"papel"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "membros_empresa_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"regras_categorizacao": {
                  Row: {
                    "ativa": boolean,"campo": string,"categoria_id": string,"centro_de_custo_id": string | null,"criado_em": string,"empresa_id": string,"id": string,"origem": string,"padrao": string,"prioridade": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ativa"?: boolean,"campo"?: string,"categoria_id": string,"centro_de_custo_id"?: string | null,"criado_em"?: string,"empresa_id": string,"id"?: string,"origem": string,"padrao": string,"prioridade"?: number
                  }
                  Update: {
                    "ativa"?: boolean,"campo"?: string,"categoria_id"?: string,"centro_de_custo_id"?: string | null,"criado_em"?: string,"empresa_id"?: string,"id"?: string,"origem"?: string,"padrao"?: string,"prioridade"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "regras_categorizacao_empresa_id_categoria_id_fkey"
      columns: ["empresa_id","categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "regras_categorizacao_empresa_id_centro_de_custo_id_fkey"
      columns: ["empresa_id","centro_de_custo_id"]
isOneToOne: false
      referencedRelation: "centros_de_custo"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "regras_categorizacao_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"transacoes": {
                  Row: {
                    "atualizado_em": string,"categoria_definida_pelo_usuario": boolean,"categoria_do_provedor": string | null,"categoria_id": string | null,"categoria_origem": string | null,"categorizacao_automatica_em": string | null,"centro_de_custo_id": string | null,"conexao_id": string,"confianca_ia": number | null,"conta_id": string,"contraparte": string | null,"criado_em": string,"data": string,"descricao": string,"descricao_original": string | null,"empresa_id": string,"id": string,"id_externo": string,"metodo_de_pagamento": string | null,"pendente": boolean,"regra_id": string | null,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"categoria_definida_pelo_usuario"?: boolean,"categoria_do_provedor"?: string | null,"categoria_id"?: string | null,"categoria_origem"?: string | null,"categorizacao_automatica_em"?: string | null,"centro_de_custo_id"?: string | null,"conexao_id": string,"confianca_ia"?: number | null,"conta_id": string,"contraparte"?: string | null,"criado_em"?: string,"data": string,"descricao": string,"descricao_original"?: string | null,"empresa_id": string,"id"?: string,"id_externo": string,"metodo_de_pagamento"?: string | null,"pendente"?: boolean,"regra_id"?: string | null,"valor": number
                  }
                  Update: {
                    "atualizado_em"?: string,"categoria_definida_pelo_usuario"?: boolean,"categoria_do_provedor"?: string | null,"categoria_id"?: string | null,"categoria_origem"?: string | null,"categorizacao_automatica_em"?: string | null,"centro_de_custo_id"?: string | null,"conexao_id"?: string,"confianca_ia"?: number | null,"conta_id"?: string,"contraparte"?: string | null,"criado_em"?: string,"data"?: string,"descricao"?: string,"descricao_original"?: string | null,"empresa_id"?: string,"id"?: string,"id_externo"?: string,"metodo_de_pagamento"?: string | null,"pendente"?: boolean,"regra_id"?: string | null,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "transacoes_empresa_id_categoria_id_fkey"
      columns: ["empresa_id","categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "transacoes_empresa_id_centro_de_custo_id_fkey"
      columns: ["empresa_id","centro_de_custo_id"]
isOneToOne: false
      referencedRelation: "centros_de_custo"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "transacoes_empresa_id_conexao_id_fkey"
      columns: ["empresa_id","conexao_id"]
isOneToOne: false
      referencedRelation: "conexoes"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "transacoes_empresa_id_conta_id_fkey"
      columns: ["empresa_id","conta_id"]
isOneToOne: false
      referencedRelation: "contas"
      referencedColumns: ["empresa_id","id"]
    },{
      foreignKeyName: "transacoes_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transacoes_empresa_id_regra_id_fkey"
      columns: ["empresa_id","regra_id"]
isOneToOne: false
      referencedRelation: "regras_categorizacao"
      referencedColumns: ["empresa_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "aplicar_categorizacao_automatica":
{ Args: { "p_empresa": string,"p_resultados": Json }; Returns: number
                           },
"consumir_limite_de_requisicao":
{ Args: { "p_chave": string,"p_janela_segundos": number,"p_maximo": number }; Returns: boolean
                           },
"garantir_empresa":
{ Args: { "p_nome": string }; Returns: string
                           },
"painel_fluxo_mensal":
{ Args: { "p_ate": string,"p_de": string,"p_empresa": string }; Returns: {
              "entradas_centavos": number,"mes": string,"saidas_centavos": number
            }[]
                           },
"painel_por_categoria":
{ Args: { "p_ate": string,"p_de": string,"p_empresa": string }; Returns: {
              "categoria_id": string,"nome": string,"quantidade": number,"total_centavos": number
            }[]
                           },
"painel_por_centro_de_custo":
{ Args: { "p_ate": string,"p_de": string,"p_empresa": string }; Returns: {
              "centro_de_custo_id": string,"entradas_centavos": number,"nome": string,"saidas_centavos": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
